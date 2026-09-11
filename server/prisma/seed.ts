import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const demoPassword = process.env.DEMO_USER_PASSWORD || 'Fundsroom@2026';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(demoPassword, saltRounds);

  const demoUsers = [
    {
      email: 'admin@fundsroom.local',
      name: 'System Administrator',
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
    {
      email: 'sales@fundsroom.local',
      name: 'Sales Executive',
      role: Role.SALES,
      passwordHash,
      isActive: true,
    },
    {
      email: 'warehouse@fundsroom.local',
      name: 'Warehouse Manager',
      role: Role.WAREHOUSE,
      passwordHash,
      isActive: true,
    },
    {
      email: 'accounts@fundsroom.local',
      name: 'Accounts Specialist',
      role: Role.ACCOUNTS,
      passwordHash,
      isActive: true,
    },
  ];

  console.log('[Seed] Seeding demo users with roles...');

  for (const user of demoUsers) {
    const upsertedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        isActive: user.isActive,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        isActive: user.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    console.log(`[Seed] User ready: ${upsertedUser.email} (${upsertedUser.role})`);
  }

  console.log('[Seed] Demo users successfully seeded.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
