// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL schema (production default)
// Prisma 7 — url moved to prisma.config.ts, client generated via `prisma-client`
// ─────────────────────────────────────────────────────────────────────────────

generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["postgresqlExtensions"]
}

datasource db {
    provider   = "postgresql"
    url        = env("DATABASE_URL")
    extensions = [citext()]
}

enum UserRole {
    USER
    ADMIN
    MODERATOR

    @@map("user_role")
}

enum UserPermission {
    create_collection
    read_own_collections
    update_own_collections
    delete_own_collections
    read_all_collections
}

enum ExerciseType {
    FILL_IN_THE_BLANK
    CHOICE_SINGLE
}

enum CollectionAccessLevel {
    VIEW
    STUDY
    EDIT

    @@map("collection_access_level")
}

model Permissions {
    id          String         @id @default(cuid())
    name        UserPermission @unique
    description String?
    users       User[]

    @@map("permissions")
}

model User {
    id            String        @id @default(cuid())
    email         String        @unique @db.Citext
    name          String        @default("default name")
    role          UserRole      @default(USER)
    isActive      Boolean       @default(true) @map("is_active")
    lastLogin     DateTime?     @map("last_login_at")
    createdAt     DateTime      @default(now()) @map("created_at")
    updatedAt     DateTime      @updatedAt @map("updated_at")
    emailVerified Boolean       @default(false)
    image         String?
    sessions      Session[]
    accounts      Account[]
    collections   Collection[]
    permissions   Permissions[]
    Attempt       Attempt[]
    collectionShares        CollectionShare[] @relation("SharedWithUser")
    grantedCollectionShares CollectionShare[] @relation("GrantedByUser")

    @@index([role], name: "user_role_idx")
    @@index([createdAt], name: "user_created_at_idx")
    @@index([isActive], name: "user_is_active_idx")
    @@map("users")
}

model Session {
    id        String   @id @default(cuid())
    expiresAt DateTime
    token     String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    ipAddress String?
    userAgent String?
    userId    String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([token])
    @@map("session")
}

model Account {
    id                    String    @id @default(cuid())
    accountId             String
    providerId            String
    userId                String
    user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    accessToken           String?
    refreshToken          String?
    idToken               String?
    accessTokenExpiresAt  DateTime?
    refreshTokenExpiresAt DateTime?
    scope                 String?
    password              String?
    createdAt             DateTime  @default(now())
    updatedAt             DateTime  @updatedAt

    @@map("account")
}

model Verification {
    id         String   @id @default(cuid())
    identifier String
    value      String
    expiresAt  DateTime
    createdAt  DateTime @default(now())
    updatedAt  DateTime @default(now()) @updatedAt

    @@map("verification")
}

model Collection {
    id          String   @id @default(cuid())
    name        String
    description String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    userId      String
    user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    exercises Exercise[]
    shares    CollectionShare[]

    @@map("collections")
}

model Exercise {
    id                       String       @id @default(cuid())
    collectionId             String
    collection               Collection   @relation(fields: [collectionId], references: [id], onDelete: Cascade)
    type                     ExerciseType @default(FILL_IN_THE_BLANK)
    question                 String       @db.Text
    placeholderSequence      String?      @default("***") @map("placeholder_sequence")
    correctAnswer            String       @map("correct_answer")
    // Option A — JSON-encoded arrays, provider-agnostic
    additionalCorrectAnswers String       @default("[]") @map("additional_correct_answers")
    distractors              String       @default("[]")
    translation              String?      @db.Text
    audioUrl                 String?
    imageUrl                 String?
    explanation              String?      @db.Text
    isActive                 Boolean      @default(true)
    createdAt                DateTime     @default(now())
    updatedAt                DateTime     @updatedAt
    Attempt                  Attempt[]

    @@index([collectionId])
    @@map("exercises")
}

model Attempt {
    id         String   @id @default(cuid())
    exerciseId String
    exercise   Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
    userId     String
    user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    answer     String   @default("")
    isCorrect  Boolean
    createdAt  DateTime @default(now())

    @@index([userId, exerciseId])
    @@index([createdAt])
    @@map("attempts")
}

model CollectionShare {
    id           String                @id @default(cuid())
    collectionId String
    collection   Collection            @relation(fields: [collectionId], references: [id], onDelete: Cascade)
    userId       String
    user         User                  @relation("SharedWithUser", fields: [userId], references: [id], onDelete: Cascade)
    accessLevel  CollectionAccessLevel @default(STUDY) @map("access_level")
    grantedById  String?
    grantedBy    User?                 @relation("GrantedByUser", fields: [grantedById], references: [id], onDelete: SetNull)
    grantedAt    DateTime              @default(now()) @map("granted_at")

    @@unique([collectionId, userId])
    @@index([userId])
    @@index([grantedById])

    @@map("collection_shares")
}