import { scoreToGrade } from '../src/types.js';

describe('scoreToGrade', () => {
  it('returns A+ for 95+', () => {
    expect(scoreToGrade(95)).toBe('A+');
    expect(scoreToGrade(100)).toBe('A+');
  });

  it('returns A for 90-94', () => {
    expect(scoreToGrade(90)).toBe('A');
    expect(scoreToGrade(94)).toBe('A');
  });

  it('returns B+ for 80-84', () => {
    expect(scoreToGrade(80)).toBe('B+');
    expect(scoreToGrade(84)).toBe('B+');
  });

  it('returns C for 60-64', () => {
    expect(scoreToGrade(60)).toBe('C');
    expect(scoreToGrade(64)).toBe('C');
  });

  it('returns D for 50-54', () => {
    expect(scoreToGrade(50)).toBe('D');
    expect(scoreToGrade(54)).toBe('D');
  });

  it('returns F for below 50', () => {
    expect(scoreToGrade(49)).toBe('F');
    expect(scoreToGrade(0)).toBe('F');
  });

  it('covers all grade boundaries', () => {
    expect(scoreToGrade(85)).toBe('A-');
    expect(scoreToGrade(75)).toBe('B');
    expect(scoreToGrade(70)).toBe('B-');
    expect(scoreToGrade(65)).toBe('C+');
    expect(scoreToGrade(55)).toBe('C-');
  });
});
