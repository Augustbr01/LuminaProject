import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGoalDto } from './create-goal.dto';

describe('CreateGoalDto', () => {
  const futureDate = '2030-01-01T00:00:00.000Z';

  const build = (overrides: Record<string, unknown>): CreateGoalDto =>
    plainToInstance(CreateGoalDto, {
      name: 'Reserva de emergência',
      targetAmount: 5000,
      deadline: futureDate,
      ...overrides,
    });

  it('accepts a valid payload', async () => {
    const errors = await validate(build({}));
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const errors = await validate(build({ name: '' }));
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a missing name', async () => {
    const errors = await validate(build({ name: undefined }));
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects targetAmount equal to zero', async () => {
    const errors = await validate(build({ targetAmount: 0 }));
    expect(errors.some((e) => e.property === 'targetAmount')).toBe(true);
  });

  it('rejects a negative targetAmount', async () => {
    const errors = await validate(build({ targetAmount: -100 }));
    expect(errors.some((e) => e.property === 'targetAmount')).toBe(true);
  });

  it('rejects a non-numeric targetAmount', async () => {
    const errors = await validate(build({ targetAmount: 'abc' }));
    expect(errors.some((e) => e.property === 'targetAmount')).toBe(true);
  });

  it('rejects a deadline in the past', async () => {
    const errors = await validate(
      build({ deadline: '2020-01-01T00:00:00.000Z' }),
    );
    expect(errors.some((e) => e.property === 'deadline')).toBe(true);
  });

  it('rejects an invalid deadline', async () => {
    const errors = await validate(build({ deadline: 'not-a-date' }));
    expect(errors.some((e) => e.property === 'deadline')).toBe(true);
  });

  it('accepts a future deadline', async () => {
    const errors = await validate(build({ deadline: futureDate }));
    expect(errors.filter((e) => e.property === 'deadline')).toHaveLength(0);
  });
});
