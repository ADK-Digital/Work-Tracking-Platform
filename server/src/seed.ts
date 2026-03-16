import { ActivityEventType, WorkItemType } from '@prisma/client';
import { prisma } from './db';

async function main() {
  await prisma.activityEvent.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.taskProjectOption.deleteMany();
  await prisma.workItemStatus.deleteMany();


  const statuses = await prisma.$transaction([
    prisma.workItemStatus.create({ data: { workType: WorkItemType.task, statusKey: 'submitted', label: 'Submitted', sortOrder: 1 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.task, statusKey: 'in_progress', label: 'In Progress', sortOrder: 2 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.task, statusKey: 'on_hold', label: 'On Hold', sortOrder: 3 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.task, statusKey: 'completed', label: 'Completed', sortOrder: 4 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.purchase_request, statusKey: 'submitted', label: 'Submitted', sortOrder: 1 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.purchase_request, statusKey: 'quote_requested', label: 'Quote Requested', sortOrder: 2 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.purchase_request, statusKey: 'quote_received', label: 'Quote Received', sortOrder: 3 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.purchase_request, statusKey: 'ordered', label: 'Ordered', sortOrder: 4 } }),
    prisma.workItemStatus.create({ data: { workType: WorkItemType.purchase_request, statusKey: 'completed', label: 'Completed', sortOrder: 5 } }),
  ]);

  const statusByTypeAndKey = new Map(statuses.map((status) => [`${status.workType}:${status.statusKey}`, status.id]));

  const seedItems = [
    {
      type: WorkItemType.task,
      title: 'Prepare Q2 roadmap review',
      description: 'Draft slides and align with stakeholders.',
      statusId: statusByTypeAndKey.get('task:in_progress')!,
      projectName: 'ERP Modernization',
      ownerGoogleId: 'mock-owner-001',
      ownerEmail: 'alex.kim@example.org',
      ownerName: 'Alex Kim',
    },
    {
      type: WorkItemType.task,
      title: 'Audit vendor contracts',
      description: null,
      statusId: statusByTypeAndKey.get('task:submitted')!,
      projectName: 'Vendor Operations',
      ownerGoogleId: 'mock-owner-002',
      ownerEmail: 'morgan.lee@example.org',
      ownerName: 'Morgan Lee',
    },
    {
      type: WorkItemType.purchase_request,
      title: 'Request laptops for new hires',
      description: 'Need 4 MacBook Pros before onboarding.',
      statusId: statusByTypeAndKey.get('purchase_request:submitted')!,
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
