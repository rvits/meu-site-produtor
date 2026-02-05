/*
  Warnings:

  - Added the required column `nomeCompleto` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeCompleto" TEXT NOT NULL,
    "nomeArtistico" TEXT NOT NULL,
    "nomeSocial" TEXT,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cep" TEXT,
    "cpf" TEXT,
    "dataNascimento" DATETIME NOT NULL,
    "sexo" TEXT,
    "genero" TEXT,
    "generoOutro" TEXT,
    "estilosMusicais" TEXT,
    "nacionalidade" TEXT,
    "foto" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" DATETIME,
    "blockedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("bairro", "blocked", "blockedAt", "blockedReason", "cep", "cidade", "cpf", "createdAt", "dataNascimento", "email", "estado", "estilosMusicais", "foto", "genero", "generoOutro", "id", "nacionalidade", "nomeArtistico", "nomeSocial", "nomeCompleto", "pais", "role", "senha", "sexo", "telefone") SELECT "bairro", "blocked", "blockedAt", "blockedReason", "cep", "cidade", "cpf", "createdAt", "dataNascimento", "email", "estado", "estilosMusicais", "foto", "genero", "generoOutro", "id", "nacionalidade", "nomeArtistico", "nomeSocial", COALESCE("nomeArtistico", 'Usuário') as "nomeCompleto", "pais", "role", "senha", "sexo", "telefone" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_blocked_idx" ON "User"("blocked");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
