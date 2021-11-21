export function getServerlessStage(): string {
  const stage = process.argv.find(
    (value, index, args) => ['--stage', '-s'].includes(args[index - 1]) && value
  );
  if (stage) return stage;
  if (process.env.STAGE) return process.env.STAGE;
  throw new Error('Stage not found');
}

export function getServerlessEnv(): string {
  return getServerlessStage().split('-')[0];
}
