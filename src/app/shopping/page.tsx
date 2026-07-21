"use client";

/**
 * Shopping — GO-03E: página "em breve" comercial com Design System.
 * Sem novas funcionalidades de e-commerce (Architecture Freeze).
 */

import {
  ComingSoon,
  LinkButton,
  PageHeader,
  Section,
} from "@/components/design-system";

export default function ShoppingPage() {
  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10 text-zinc-100 min-h-[70vh]">
      <div
        className="fixed inset-0 z-0 bg-no-repeat bg-zinc-950 page-bg-image opacity-40"
        style={{
          backgroundImage: "url(/shopping-bg.png.png)",
          ["--page-bg-size" as string]: "cover",
          ["--page-bg-position" as string]: "center center",
        }}
        aria-hidden
      />
      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Shopping THouse Rec"
          subtitle="Beats, packs e conteúdos exclusivos do estúdio — em breve."
          icon="sparkles"
        />

        <Section>
          <ComingSoon
            title="Shopping em preparação"
            description="Estamos finalizando uma experiência de compra organizada, segura e alinhada à proposta criativa do estúdio."
            actions={
              <>
                <LinkButton href="/agendamento" variant="primary">
                  Agendar serviço
                </LinkButton>
                <LinkButton href="/planos" variant="outline">
                  Ver planos
                </LinkButton>
                <LinkButton href="/minha-conta" variant="ghost">
                  Minha Conta
                </LinkButton>
              </>
            }
          />
        </Section>
      </div>
    </main>
  );
}
