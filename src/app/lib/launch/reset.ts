/**
 * LAUNCH-01 — reset de produção preservando apenas o admin Victor Pereira Ramos.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";

export const PRESERVE_ADMIN_NAME = "Victor Pereira Ramos";

export type LaunchResetResult = {
  mode: "dry-run" | "execute";
  preservedAdmin: { id: string; email: string; nomeCompleto: string } | null;
  usersBefore: number;
  usersAfter: number;
  deleted: Record<string, number>;
  uploadsRemoved: number;
  reportFilesRemoved: number;
  warnings: string[];
};

export const PRESERVE_ADMIN_EMAILS = new Set([
  "thouse.rec.tremv@gmail.com",
  "tremv03021@gmail.com",
  "vicperra@gmail.com",
]);

export async function findPreservedAdmin(prisma: PrismaClient) {
  const exact = await prisma.user.findFirst({
    where: { nomeCompleto: PRESERVE_ADMIN_NAME, role: "ADMIN" },
    select: { id: true, email: true, nomeCompleto: true, foto: true },
  });
  if (exact) return exact;

  for (const email of PRESERVE_ADMIN_EMAILS) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, role: "ADMIN" },
      select: { id: true, email: true, nomeCompleto: true, foto: true },
    });
    if (byEmail) return byEmail;
  }

  return prisma.user.findFirst({
    where: {
      role: "ADMIN",
      NOT: { email: { endsWith: "@homolog.test", mode: "insensitive" } },
      OR: [
        { nomeCompleto: { contains: "Victor", mode: "insensitive" } },
        { nomeArtistico: { in: ["TremV", "Tremv", "tremv"] } },
      ],
    },
    select: { id: true, email: true, nomeCompleto: true, foto: true },
  });
}

async function countAll(prisma: PrismaClient) {
  const [
    users,
    appointments,
    services,
    payments,
    coupons,
    userPlans,
    syncEvents,
    transitionHistory,
    paymentMetadata,
    sessions,
    loginLogs,
    chatSessions,
    userQuestions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.appointment.count(),
    prisma.service.count(),
    prisma.payment.count(),
    prisma.coupon.count(),
    prisma.userPlan.count(),
    prisma.synchronizationEvent.count(),
    prisma.domainTransitionHistory.count(),
    prisma.paymentMetadata.count(),
    prisma.session.count(),
    prisma.loginLog.count(),
    prisma.chatSession.count(),
    prisma.userQuestion.count(),
  ]);
  return {
    users,
    appointments,
    services,
    payments,
    coupons,
    userPlans,
    synchronizationEvents: syncEvents,
    domainTransitionHistory: transitionHistory,
    paymentMetadata,
    sessions,
    loginLogs,
    chatSessions,
    userQuestions,
  };
}

function cleanTemporaryReports(root: string, execute: boolean): number {
  const dir = path.resolve(root, "reports/domain-guardian");
  if (!fs.existsSync(dir)) return 0;
  const patterns = [
    /^sim\d+-last-run\.json$/,
    /^rc\d+-execution.*\.json$/,
    /^launch01-reset.*\.json$/,
    /-certify-run.*\.log$/,
  ];
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!patterns.some((re) => re.test(entry))) continue;
    if (execute) fs.unlinkSync(path.join(dir, entry));
    removed++;
  }
  return removed;
}

function cleanUploads(root: string, preserveAvatarUrl: string | null | undefined, execute: boolean): number {
  const uploadsRoot = path.resolve(root, "public/uploads");
  if (!fs.existsSync(uploadsRoot)) return 0;
  let removed = 0;
  const preserveFile = preserveAvatarUrl
    ? path.basename(preserveAvatarUrl.replace(/^\//, ""))
    : null;

  for (const folder of ["avatars", "deliveries", "tmp", "temp", "homolog"]) {
    const target = path.join(uploadsRoot, folder);
    if (!fs.existsSync(target)) continue;
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (folder === "avatars" && preserveFile && entry.name === preserveFile) continue;
      if (execute) fs.unlinkSync(path.join(target, entry.name));
      removed++;
    }
  }
  return removed;
}

export async function runLaunchReset(
  prisma: PrismaClient,
  opts: { execute: boolean; root?: string }
): Promise<LaunchResetResult> {
  const root = opts.root || process.cwd();
  const warnings: string[] = [];
  const deleted: Record<string, number> = {};

  const preserved = await findPreservedAdmin(prisma);
  if (!preserved) {
    return {
      mode: opts.execute ? "execute" : "dry-run",
      preservedAdmin: null,
      usersBefore: await prisma.user.count(),
      usersAfter: await prisma.user.count(),
      deleted,
      uploadsRemoved: 0,
      reportFilesRemoved: 0,
      warnings: ["ADMIN Victor Pereira Ramos não encontrado — reset abortado"],
    };
  }

  const before = await countAll(prisma);
  deleted._before = before.users as unknown as number;

  const otherUsers = await prisma.user.findMany({
    where: { id: { not: preserved.id } },
    select: { id: true, email: true },
  });

  if (opts.execute) {
    const otherIds = otherUsers.map((u) => u.id);

    deleted.synchronizationEvents = (await prisma.synchronizationEvent.deleteMany({})).count;

    deleted.domainTransitionHistory = (await prisma.domainTransitionHistory.deleteMany({})).count;

    deleted.chatSessions = (await prisma.chatSession.deleteMany({})).count;

    deleted.userQuestions = (await prisma.userQuestion.deleteMany({})).count;
    deleted.loginLogs = (await prisma.loginLog.deleteMany({})).count;
    deleted.sessions = (
      await prisma.session.deleteMany({
        where: { userId: { in: [...otherIds, preserved.id] } },
      })
    ).count;

    deleted.coupons = (await prisma.coupon.deleteMany({})).count;
    deleted.services = (await prisma.service.deleteMany({})).count;
    deleted.appointments = (await prisma.appointment.deleteMany({})).count;
    deleted.subscriptions = (await prisma.subscription.deleteMany({})).count;
    deleted.userPlans = (await prisma.userPlan.deleteMany({})).count;
    deleted.payments = (await prisma.payment.deleteMany({})).count;
    deleted.paymentMetadata = (await prisma.paymentMetadata.deleteMany({})).count;
    deleted.accountDeletionLogs = (await prisma.accountDeletionLog.deleteMany({})).count;
    deleted.passwordResetCodes = (await prisma.passwordResetCode.deleteMany({})).count;

    if (otherIds.length) {
      deleted.users = (await prisma.user.deleteMany({ where: { id: { in: otherIds } } })).count;
    } else {
      deleted.users = 0;
    }
  } else {
    deleted.synchronizationEvents = before.synchronizationEvents;
    deleted.domainTransitionHistory = before.domainTransitionHistory;
    deleted.chatSessions = before.chatSessions;
    deleted.userQuestions = before.userQuestions;
    deleted.loginLogs = before.loginLogs;
    deleted.sessions = before.sessions;
    deleted.coupons = before.coupons;
    deleted.services = before.services;
    deleted.appointments = before.appointments;
    deleted.userPlans = before.userPlans;
    deleted.payments = before.payments;
    deleted.paymentMetadata = before.paymentMetadata;
    deleted.users = otherUsers.length;
  }

  const uploadsRemoved = cleanUploads(root, preserved.foto, opts.execute);
  const reportFilesRemoved = cleanTemporaryReports(root, opts.execute);

  const usersAfter = opts.execute ? await prisma.user.count() : 1;
  if (opts.execute && usersAfter !== 1) {
    warnings.push(`Esperado 1 usuário após reset; encontrado ${usersAfter}`);
  }

  return {
    mode: opts.execute ? "execute" : "dry-run",
    preservedAdmin: {
      id: preserved.id,
      email: preserved.email,
      nomeCompleto: preserved.nomeCompleto,
    },
    usersBefore: before.users,
    usersAfter,
    deleted,
    uploadsRemoved,
    reportFilesRemoved,
    warnings,
  };
}
