/**
 * Database seed script
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create sample job positions
  const positions = await Promise.all([
    prisma.jobPosition.upsert({
      where: { id: 'pos-senior-backend' },
      update: {},
      create: {
        id: 'pos-senior-backend',
        title: 'Senior Backend Developer',
        department: 'Engineering',
        description:
          'We are looking for a Senior Backend Developer to join our growing engineering team. You will be responsible for designing, developing, and maintaining scalable backend services.',
        requirements: [
          '5+ years of experience in backend development',
          'Strong proficiency in Node.js/TypeScript or Python',
          'Experience with PostgreSQL and Redis',
          'Understanding of microservices architecture',
          'Excellent problem-solving skills',
        ],
        responsibilities: [
          'Design and implement scalable APIs',
          'Write clean, maintainable, and well-tested code',
          'Collaborate with frontend and mobile teams',
          'Participate in code reviews',
          'Mentor junior developers',
        ],
        salaryMin: 120000,
        salaryMax: 180000,
        salaryCurrency: 'USD',
        location: 'San Francisco, CA',
        isRemote: true,
        isActive: true,
      },
    }),

    prisma.jobPosition.upsert({
      where: { id: 'pos-product-manager' },
      update: {},
      create: {
        id: 'pos-product-manager',
        title: 'Product Manager',
        department: 'Product',
        description:
          'We are seeking a Product Manager to help define and execute our product strategy. You will work closely with engineering, design, and business teams.',
        requirements: [
          '3+ years of product management experience',
          'Strong analytical and problem-solving skills',
          'Excellent communication skills',
          'Experience with agile methodologies',
          'Technical background preferred',
        ],
        responsibilities: [
          'Define product roadmap and priorities',
          'Gather and analyze user feedback',
          'Write detailed product requirements',
          'Coordinate cross-functional teams',
          'Track and report on product metrics',
        ],
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: 'USD',
        location: 'New York, NY',
        isRemote: true,
        isActive: true,
      },
    }),

    prisma.jobPosition.upsert({
      where: { id: 'pos-frontend-developer' },
      update: {},
      create: {
        id: 'pos-frontend-developer',
        title: 'Frontend Developer',
        department: 'Engineering',
        description:
          'Join our team as a Frontend Developer to build beautiful, responsive web applications. You will work on our customer-facing products using modern technologies.',
        requirements: [
          '3+ years of frontend development experience',
          'Strong proficiency in React and TypeScript',
          'Experience with modern CSS and responsive design',
          'Familiarity with testing frameworks',
          'Understanding of web performance optimization',
        ],
        responsibilities: [
          'Build and maintain web applications',
          'Implement responsive and accessible UI components',
          'Collaborate with designers and backend developers',
          'Write unit and integration tests',
          'Optimize application performance',
        ],
        salaryMin: 90000,
        salaryMax: 140000,
        salaryCurrency: 'USD',
        location: 'Austin, TX',
        isRemote: true,
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${positions.length} job positions`);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
