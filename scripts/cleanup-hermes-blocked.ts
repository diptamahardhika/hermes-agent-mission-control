import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up blocked Hermes tasks...');
  const result = await prisma.hermesTask.deleteMany({
    where: {
      status: 'blocked',
    },
  });
  console.log(`Successfully removed ${result.count} blocked tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
