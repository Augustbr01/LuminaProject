import type { PrismaService } from '../../src/common/prisma/prisma.service';

type MockFn = jest.Mock;

interface MockModel {
  findUnique: MockFn;
  findUniqueOrThrow: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  upsert: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
  groupBy: MockFn;
  aggregate: MockFn;
}

export interface PrismaMock extends Pick<
  PrismaService,
  '$connect' | '$disconnect'
> {
  user: MockModel;
  extrato: MockModel;
  transaction: MockModel;
  goal: MockModel;
  $transaction: MockFn;
  $connect: MockFn;
  $disconnect: MockFn;
}

const makeModel = (): MockModel => ({
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  groupBy: jest.fn(),
  aggregate: jest.fn(),
});

export const createPrismaMock = (): PrismaMock => ({
  user: makeModel(),
  extrato: makeModel(),
  transaction: makeModel(),
  goal: makeModel(),
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
});
