import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    jest
      .spyOn(service as unknown as { $connect(): Promise<void> }, '$connect')
      .mockImplementation(() => Promise.resolve());
    jest
      .spyOn(
        service as unknown as { $disconnect(): Promise<void> },
        '$disconnect',
      )
      .mockImplementation(() => Promise.resolve());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should connect on module init without error', async () => {
    await expect(service.onModuleInit()).resolves.not.toThrow();
    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('should disconnect on module destroy without error', async () => {
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
