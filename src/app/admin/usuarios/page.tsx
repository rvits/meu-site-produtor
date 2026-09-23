"use client";

import { useEffect, useState } from "react";
import {
  useFeedback,
  LoadingBlock,
  EmptyState,
  ErrorState,
  PageHeader,
  Card,
  SearchInput,
  Select,
  Button,
  Badge,
  Callout,
  Field,
  Input,
  Modal,
} from "@/components/design-system";
import { SEXUAL_ORIENTATION_OPTIONS } from "@/app/lib/sexual-orientation";
import { civilDateUtc, formatCivilDateBr } from "@/app/lib/birth-date-validation";

interface PlanoUsuario {
  id: string;
  planId: string;
  planName: string;
  modo: string;
  amount: number;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  subscription?: {
    id: string;
    status: string;
    paymentMethod: string;
    billingDay: number;
    nextBillingDate: string;
    lastBillingDate: string | null;
  } | null;
}

interface CupomUsuario {
  id: string;
  code: string;
  couponType: string; // "plano" ou "reembolso"
  discountType: string;
  discountValue: number;
  serviceType: string | null;
  used: boolean;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Usuario {
  id: string;
  nomeCompleto: string;
  nomeArtistico: string;
  email: string;
  telefone: string;
  nomeSocial: string | null;
  cpf?: string | null;
  cep?: string | null;
  pais: string;
  estado: string;
  cidade: string;
  bairro: string;
  dataNascimento: string;
  sexo?: string | null;
  orientacaoSexual?: string | null;
  orientacaoSexualOutro?: string | null;
  genero?: string | null;
  generoOutro?: string | null;
  cpfEditavelPeloUsuario?: boolean;
  dataNascimentoEditavelPeloUsuario?: boolean;
  estilosMusicais?: string | null;
  nacionalidade?: string | null;
  foto?: string | null;
  role: string;
  blocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  createdAt: string;
  _count: {
    appointments: number;
    payments: number;
    userPlans: number;
    services: number;
  };
  lastLogin?: {
    ipAddress: string;
    userAgent: string;
    createdAt: string;
  };
  loginCount: number;
  failedLoginCount: number;
  senhaTemporaria?: string;
  planos?: PlanoUsuario[];
  cupons?: CupomUsuario[];
}

function dataCivil(value: string): string {
  return civilDateUtc(value) ?? "";
}

const GENERO_LEGADO: Record<string, string> = {
  heterossexual: "Heterossexual",
  homossexual: "Homossexual",
  bissexual: "Bissexual",
  transsexual: "Transsexual",
  nao_binario: "Não binário",
  outro: "Outro",
  prefiro_nao_informar: "Prefiro não informar",
};

function generoLegadoTexto(genero: string | null | undefined, generoOutro: string | null | undefined) {
  if (!genero) return "";
  if (genero === "outro" && generoOutro) return generoOutro;
  return GENERO_LEGADO[genero] || genero;
}

type CadastroForm = {
  nomeCompleto: string;
  nomeArtistico: string;
  nomeSocial: string;
  telefone: string;
  pais: string;
  estado: string;
  cidade: string;
  bairro: string;
  cep: string;
  cpf: string;
  dataNascimento: string;
  sexo: string;
  orientacaoSexual: string;
  orientacaoSexualOutro: string;
};

type AuditRow = {
  id: string;
  action: string;
  field: string | null;
  createdAt: string;
  admin: string;
  label: string;
};

function formularioDe(u: Usuario): CadastroForm {
  return {
    nomeCompleto: u.nomeCompleto || "",
    nomeArtistico: u.nomeArtistico || "",
    nomeSocial: u.nomeSocial || "",
    telefone: u.telefone || "",
    pais: u.pais || "",
    estado: u.estado || "",
    cidade: u.cidade || "",
    bairro: u.bairro || "",
    cep: u.cep || "",
    cpf: u.cpf || "",
    dataNascimento: dataCivil(u.dataNascimento),
    sexo: u.sexo || "",
    orientacaoSexual: u.orientacaoSexual || "",
    orientacaoSexualOutro: u.orientacaoSexualOutro || "",
  };
}

function calcularIdade(dataNascimento: string): number {
  const civil = civilDateUtc(dataNascimento);
  if (!civil) return 0;
  const [year, month, day] = civil.split("-").map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - year;
  const mes = hoje.getMonth() + 1 - month;
  if (mes < 0 || (mes === 0 && hoje.getDate() < day)) {
    idade--;
  }
  return idade;
}

export default function AdminUsuariosPage() {
  const { notifySuccess, notifyError, ask } = useFeedback();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [formCadastro, setFormCadastro] = useState<CadastroForm | null>(null);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, AuditRow[]>>({});

  useEffect(() => {
    carregarUsuarios();
  }, []);

  useEffect(() => {
    if (busca.trim() === "") {
      setUsuariosFiltrados(usuarios);
    } else {
      const termo = busca.toLowerCase();
      const filtrados = usuarios.filter(
        (u) =>
          u.nomeCompleto.toLowerCase().includes(termo) ||
          u.nomeArtistico.toLowerCase().includes(termo) ||
          u.email.toLowerCase().includes(termo) ||
          u.telefone.includes(termo)
      );
      setUsuariosFiltrados(filtrados);
    }
  }, [busca, usuarios]);

  async function carregarUsuarios() {
    try {
      const res = await fetch("/api/admin/usuarios", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsuarios(data.usuarios || []);
        setUsuariosFiltrados(data.usuarios || []);
        setErroUsuarios(null);
      } else {
        setErroUsuarios(data.error || `Erro ${res.status} ao carregar usuários`);
        setUsuarios([]);
        setUsuariosFiltrados([]);
      }
    } catch (err) {
      console.error("Erro ao carregar usuários", err);
      setErroUsuarios("Falha ao conectar. Verifique se está logado como admin.");
      setUsuarios([]);
      setUsuariosFiltrados([]);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarUsuario(id: string, updates: { role?: string; blocked?: boolean; blockedReason?: string }) {
    try {
      const res = await fetch(`/api/admin/usuarios?id=${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await carregarUsuarios();
      }
    } catch (err) {
      console.error("Erro ao atualizar usuário", err);
    }
  }

  async function resetarSenha(userId: string, email: string) {
    if (
      !(await ask(
        `Tem certeza que deseja resetar a senha de ${email}?`,
        "Uma nova senha temporária será gerada."
      ))
    ) {
      return;
    }

    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reset-password" }),
      });

      if (res.ok) {
        const data = await res.json();
        const senhaTemporaria = data.senhaTemporaria;
        
        // Atualizar o estado local para mostrar a senha
        setUsuarios(prev => prev.map(u => 
          u.id === userId ? { ...u, senhaTemporaria } : u
        ));
        setUsuariosFiltrados(prev => prev.map(u => 
          u.id === userId ? { ...u, senhaTemporaria } : u
        ));

        notifySuccess(
          "Senha resetada com sucesso!",
          `Nova senha temporária: ${senhaTemporaria} — copie e envie para o usuário.`
        );
      } else {
        notifyError("Erro ao resetar senha.");
      }
    } catch (err) {
      console.error("Erro ao resetar senha", err);
      notifyError("Erro ao resetar senha.");
    }
  }

  function abrirCadastro(usuario: Usuario) {
    setEditando(usuario);
    setFormCadastro(formularioDe(usuario));
  }

  function setCadastro<K extends keyof CadastroForm>(campo: K, valor: string) {
    setFormCadastro((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function salvarCadastro() {
    if (!editando || !formCadastro) return;
    setSalvandoCadastro(true);
    try {
      const body: Record<string, string | null> = {
        nomeCompleto: formCadastro.nomeCompleto,
        nomeArtistico: formCadastro.nomeArtistico,
        nomeSocial: formCadastro.nomeSocial.trim() ? formCadastro.nomeSocial.trim() : null,
        telefone: formCadastro.telefone,
        pais: formCadastro.pais,
        estado: formCadastro.estado,
        cidade: formCadastro.cidade,
        bairro: formCadastro.bairro,
        cep: formCadastro.cep.trim() ? formCadastro.cep.trim() : null,
        cpf: formCadastro.cpf,
        dataNascimento: formCadastro.dataNascimento,
      };
      if (formCadastro.sexo) body.sexo = formCadastro.sexo;
      if (formCadastro.orientacaoSexual) {
        body.orientacaoSexual = formCadastro.orientacaoSexual;
        body.orientacaoSexualOutro =
          formCadastro.orientacaoSexual === "outro"
            ? formCadastro.orientacaoSexualOutro
            : null;
      }
      const res = await fetch(`/api/admin/usuarios/cadastro?id=${editando.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError("Não foi possível salvar o cadastro.", data.error || "Erro ao salvar.");
        return;
      }
      notifySuccess("Cadastro atualizado.");
      setEditando(null);
      setFormCadastro(null);
      await carregarUsuarios();
    } catch (err) {
      console.error("Erro ao salvar cadastro", err);
      notifyError("Não foi possível salvar o cadastro.");
    } finally {
      setSalvandoCadastro(false);
    }
  }

  async function alternarCorrecao(
    id: string,
    campo: "cpf" | "nascimento",
    enabled: boolean
  ) {
    const body =
      campo === "cpf"
        ? { cpfEditavelPeloUsuario: enabled }
        : { dataNascimentoEditavelPeloUsuario: enabled };
    try {
      const res = await fetch(`/api/admin/usuarios/correcao?id=${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError("Não foi possível atualizar a permissão.", data.error || "Erro ao salvar.");
        return;
      }
      await carregarUsuarios();
    } catch (err) {
      console.error("Erro ao atualizar permissão", err);
      notifyError("Não foi possível atualizar a permissão.");
    }
  }

  async function carregarHistorico(id: string) {
    if (historicoAberto === id) {
      setHistoricoAberto(null);
      return;
    }
    setHistoricoAberto(id);
    try {
      const res = await fetch(`/api/admin/usuarios/auditoria?id=${id}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError("Não foi possível carregar o histórico.", data.error || "Erro ao buscar.");
        return;
      }
      setHistorico((prev) => ({ ...prev, [id]: data.historico || [] }));
    } catch (err) {
      console.error("Erro ao carregar histórico", err);
      notifyError("Não foi possível carregar o histórico.");
    }
  }

  if (loading) {
    return <LoadingBlock label="Carregando usuários..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        subtitle="Gerenciar clientes, permissões e histórico de logins"
        icon="user"
      />

      {/* Input de Busca */}
      <Card>
        <SearchInput
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome completo, nome artístico, email ou telefone..."
        />
        {busca && (
          <p className="mt-2 text-sm text-zinc-400">
            {usuariosFiltrados.length} usuário(s) encontrado(s)
          </p>
        )}
      </Card>

      {erroUsuarios ? (
        <ErrorState
          title="Erro ao carregar usuários"
          description={erroUsuarios}
          onRetry={() => { setErroUsuarios(null); carregarUsuarios(); }}
        />
      ) : usuariosFiltrados.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado." />
      ) : (
        <div className="space-y-4">
          {usuariosFiltrados.map((u) => {
            const idade = calcularIdade(u.dataNascimento);
            const menorIdade = idade < 18;
            return (
              <Card
                key={u.id}
                className={`!p-6 ${u.blocked ? "!border-red-700/50 !bg-red-950/10" : ""}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Informações Básicas */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                      {u.nomeArtistico}
                      {menorIdade && <Badge intent="warning">Menor de idade</Badge>}
                    </h3>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <div><strong className="text-zinc-300">Nome Completo:</strong> {u.nomeCompleto}</div>
                      <div><strong className="text-zinc-300">Email:</strong> {u.email}</div>
                      <div><strong className="text-zinc-300">Telefone:</strong> {u.telefone}</div>
                      <div><strong className="text-zinc-300">CPF:</strong> {u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : <span className="text-yellow-400">Não cadastrado</span>}</div>
                      <div><strong className="text-zinc-300">Idade:</strong> {idade} anos</div>
                      <div><strong className="text-zinc-300">Data de Nascimento:</strong> {formatCivilDateBr(u.dataNascimento)}</div>
                      {u.senhaTemporaria && (
                        <Callout intent="warning" title="Senha Temporária:" className="mt-2">
                          <div className="font-mono text-sm text-amber-200">{u.senhaTemporaria}</div>
                          <div className="mt-1">Esta senha foi gerada agora. Envie para o usuário.</div>
                        </Callout>
                      )}
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-zinc-300">Endereço</h4>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <div>{u.bairro}, {u.cidade}</div>
                      <div>{u.estado}, {u.pais}</div>
                      {u.nacionalidade && (
                        <div><strong className="text-zinc-300">Nacionalidade:</strong> {u.nacionalidade}</div>
                      )}
                      {u.estilosMusicais && (
                        <div><strong className="text-zinc-300">Estilos:</strong> {u.estilosMusicais}</div>
                      )}
                    </div>
                  </div>

                  {/* Estatísticas e Ações */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge intent={u.role === "ADMIN" ? "error" : "info"}>{u.role}</Badge>
                      {u.blocked ? (
                        <Badge intent="error" dot>Bloqueado</Badge>
                      ) : (
                        <Badge intent="success" dot>Ativo</Badge>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <div>📅 Agendamentos: {u._count.appointments}</div>
                      <div>💰 Pagamentos: {u._count.payments}</div>
                      <div>⭐ Planos: {u._count.userPlans}</div>
                      <div>🎵 Serviços: {u._count.services}</div>
                      <div>✓ Logins: {u.loginCount} | ✗ Falhas: {u.failedLoginCount}</div>
                    </div>
                    {u.lastLogin && (
                      <div className="text-xs text-zinc-500">
                        Último login: {new Date(u.lastLogin.createdAt).toLocaleString("pt-BR")}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-3">
                      <div className="flex gap-2">
                        <Select
                          value={u.role}
                          onChange={(e) => atualizarUsuario(u.id, { role: e.target.value })}
                          className="!px-2 !py-1 text-xs"
                          options={[
                            { value: "USER", label: "USER" },
                            { value: "ADMIN", label: "ADMIN" },
                          ]}
                        />
                        <Button
                          variant={u.blocked ? "success" : "danger"}
                          size="xs"
                          onClick={() => atualizarUsuario(u.id, { blocked: !u.blocked, blockedReason: !u.blocked ? "Bloqueado pelo admin" : undefined })}
                        >
                          {u.blocked ? "Liberar" : "Bloquear"}
                        </Button>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        icon="lock"
                        fullWidth
                        onClick={() => resetarSenha(u.id, u.email)}
                      >
                        Resetar Senha
                      </Button>
                      <Button variant="secondary" size="xs" fullWidth onClick={() => abrirCadastro(u)}>
                        Editar cadastro
                      </Button>
                    </div>
                    <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 p-3">
                      <p className="text-xs font-semibold text-zinc-200">Permissões de correção pelo usuário</p>
                      <p className="text-[11px] text-zinc-500">
                        Essa permissão controla se o próprio usuário poderá corrigir o campo em Minha Conta.
                      </p>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="text-zinc-300">CPF</div>
                          <div className={u.cpfEditavelPeloUsuario ? "text-amber-300" : "text-zinc-500"}>
                            {u.cpfEditavelPeloUsuario ? "Edição permitida" : "Bloqueado"}
                          </div>
                        </div>
                        <Button
                          variant={u.cpfEditavelPeloUsuario ? "danger" : "secondary"}
                          size="xs"
                          onClick={() => alternarCorrecao(u.id, "cpf", !u.cpfEditavelPeloUsuario)}
                        >
                          {u.cpfEditavelPeloUsuario ? "Bloquear edição" : "Permitir edição"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="text-zinc-300">Data de nascimento</div>
                          <div className={u.dataNascimentoEditavelPeloUsuario ? "text-amber-300" : "text-zinc-500"}>
                            {u.dataNascimentoEditavelPeloUsuario ? "Edição permitida" : "Bloqueado"}
                          </div>
                        </div>
                        <Button
                          variant={u.dataNascimentoEditavelPeloUsuario ? "danger" : "secondary"}
                          size="xs"
                          onClick={() =>
                            alternarCorrecao(u.id, "nascimento", !u.dataNascimentoEditavelPeloUsuario)
                          }
                        >
                          {u.dataNascimentoEditavelPeloUsuario ? "Bloquear edição" : "Permitir edição"}
                        </Button>
                      </div>
                      <Button variant="ghost" size="xs" onClick={() => carregarHistorico(u.id)}>
                        Histórico administrativo
                      </Button>
                      {historicoAberto === u.id && (
                        <div className="space-y-1 text-[11px] text-zinc-400">
                          {(historico[u.id] || []).length === 0 ? (
                            <div>Nenhuma ação registrada.</div>
                          ) : (
                            historico[u.id].map((item) => (
                              <div key={item.id}>
                                {item.label} — {item.admin} — {new Date(item.createdAt).toLocaleString("pt-BR")}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(editando && formCadastro)}
        onClose={() => {
          if (salvandoCadastro) return;
          setEditando(null);
          setFormCadastro(null);
        }}
        title={editando ? `Editar cadastro — ${editando.nomeArtistico}` : "Editar cadastro"}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={salvandoCadastro}
              onClick={() => {
                setEditando(null);
                setFormCadastro(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" disabled={salvandoCadastro} onClick={() => void salvarCadastro()}>
              {salvandoCadastro ? "Salvando..." : "Salvar cadastro"}
            </Button>
          </>
        }
      >
        {formCadastro && editando && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome completo">
              <Input value={formCadastro.nomeCompleto} onChange={(e) => setCadastro("nomeCompleto", e.target.value)} />
            </Field>
            <Field label="Nome artístico">
              <Input value={formCadastro.nomeArtistico} onChange={(e) => setCadastro("nomeArtistico", e.target.value)} />
            </Field>
            <Field label="Nome social">
              <Input value={formCadastro.nomeSocial} onChange={(e) => setCadastro("nomeSocial", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input value={formCadastro.telefone} onChange={(e) => setCadastro("telefone", e.target.value)} />
            </Field>
            <Field label="País">
              <Input value={formCadastro.pais} onChange={(e) => setCadastro("pais", e.target.value)} />
            </Field>
            <Field label="Estado">
              <Input value={formCadastro.estado} onChange={(e) => setCadastro("estado", e.target.value)} />
            </Field>
            <Field label="Cidade">
              <Input value={formCadastro.cidade} onChange={(e) => setCadastro("cidade", e.target.value)} />
            </Field>
            <Field label="Bairro">
              <Input value={formCadastro.bairro} onChange={(e) => setCadastro("bairro", e.target.value)} />
            </Field>
            <Field label="CEP">
              <Input value={formCadastro.cep} onChange={(e) => setCadastro("cep", e.target.value)} />
            </Field>
            <Field label="CPF">
              <Input value={formCadastro.cpf} onChange={(e) => setCadastro("cpf", e.target.value)} />
            </Field>
            <Field label="Data de nascimento">
              <Input
                type="date"
                value={formCadastro.dataNascimento}
                onChange={(e) => setCadastro("dataNascimento", e.target.value)}
              />
            </Field>
            <Field label="Sexo">
              <Select
                value={formCadastro.sexo}
                onChange={(e) => setCadastro("sexo", e.target.value)}
                options={[
                  { value: "", label: "Selecione..." },
                  { value: "masculino", label: "Masculino" },
                  { value: "feminino", label: "Feminino" },
                  { value: "prefiro_nao_declarar", label: "Prefiro não declarar" },
                ]}
              />
            </Field>
            <Field label="Orientação sexual">
              <Select
                value={formCadastro.orientacaoSexual}
                onChange={(e) => {
                  setCadastro("orientacaoSexual", e.target.value);
                  if (e.target.value !== "outro") setCadastro("orientacaoSexualOutro", "");
                }}
                options={[{ value: "", label: "Selecione..." }, ...SEXUAL_ORIENTATION_OPTIONS]}
              />
            </Field>
            {formCadastro.orientacaoSexual === "outro" && (
              <Field label="Complemento">
                <Input
                  value={formCadastro.orientacaoSexualOutro}
                  onChange={(e) => setCadastro("orientacaoSexualOutro", e.target.value)}
                />
              </Field>
            )}
            {editando.genero && (
              <Field label="Gênero (cadastro anterior)">
                <Input value={generoLegadoTexto(editando.genero, editando.generoOutro)} readOnly disabled />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
