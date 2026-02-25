import { ActivityEventType, WorkItemType } from '@prisma/client';
import { prisma } from './db';

async function main() {
  await prisma.activityEvent.deleteMany();
  await prisma.workItem.deleteMany();

  const seedItems = [
    {
      type: WorkItemType.task,
      title: 'Prepare Q2 roadmap review',
      description: 'Draft slides and align with stakeholders.',
      status: 'in_progress',
      owner: 'Alex',
    },
    {
      type: WorkItemType.task,
      title: 'Audit vendor contracts',
      description: null,
      status: 'todo',
      owner: null,
    },
    {
      type: WorkItemType.purchase_request,
      title: 'Request laptops for new hires',
      description: 'Need 4 MacBook Pros before onboarding.',
      status: 'pending_approval',
      owner: 'Priya',
    },
  ];

  const workItems = await Promise.all(seedItems.map((item) => prisma.workItem.create({ data: item })));

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
