import { ActivityEventType, WorkItemType } from '@prisma/client';
import { prisma } from './db';

async function main() {
  await prisma.activityEvent.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.taskProjectOption.deleteMany();

  const seedItems = [
    {
      type: WorkItemType.task,
      title: 'Prepare Q2 roadmap review',
      description: 'Draft slides and align with stakeholders.',
      status: 'in_progress',
      projectName: 'ERP Modernization',
      ownerGoogleId: 'mock-owner-001',
      ownerEmail: 'alex.kim@example.org',
      ownerName: 'Alex Kim',
    },
    {
      type: WorkItemType.task,
      title: 'Audit vendor contracts',
      description: null,
      status: 'todo',
      projectName: 'Vendor Operations',
      ownerGoogleId: 'mock-owner-002',
      ownerEmail: 'morgan.lee@example.org',
      ownerName: 'Morgan Lee',
    },
    {
      type: WorkItemType.purchase_request,
      title: 'Request laptops for new hires',
      description: 'Need 4 MacBook Pros before onboarding.',
      status: 'pending_approval',
      ownerGoogleId: 'mock-owner-003',
      ownerEmail: 'chris.nguyen@example.org',
      ownerName: 'Chris Nguyen',
    },
  ];

  const workItems = await Promise.all(seedItems.map((item) => prisma.workItem.create({ data: item })));

  await prisma.taskProjectOption.createMany({
    data: [{ name: 'ERP Modernization' }, { name: 'Vendor Operations' }],
    skipDuplicates: true,
  });

  await prisma.activityEvent.createMany({
    data: workItems.flatMap((item) => [
      {
        workItemId: item.id,
        type: ActivityEventType.created,
        message: 'Work item created',
      },
      {
        workItemId: item.id,
        type: ActivityEventType.updated,
        message: 'Seeded demo activity',
      },
    ]),
  });

  console.log(`Seeded ${workItems.length} work items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
