import fs from 'fs/promises';
import { GitContext } from './context';

export async function readFile(ctx: GitContext, filePath: string): Promise<string> {
  const abs = await ctx.resolveRepoPath(filePath);
  return fs.readFile(abs, 'utf-8');
}

export async function writeFile(ctx: GitContext, filePath: string, content: string): Promise<void> {
  const abs = await ctx.resolveRepoPath(filePath);
  await fs.writeFile(abs, content, 'utf-8');
}
