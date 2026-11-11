// Supply-chain rules for the CI workflows and Dependabot (chili-platform #198, #199).
// They read the files in .github/, like a lint: nothing here runs a workflow.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../..');
const workflowsDir = join(root, '.github/workflows');
const workflows = readdirSync(workflowsDir)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(workflowsDir, name), 'utf8') }));
const dependabot = readFileSync(join(root, '.github/dependabot.yml'), 'utf8');

function usesLines(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => /^\s*(-\s*)?uses:\s*/.test(line))
    .filter((line) => !/uses:\s*\.\//.test(line));
}

describe('CI supply chain', () => {
  it.each(workflows)('$name pins every action to a commit SHA with its version', ({ text }) => {
    // A tag such as @v4 can be moved to other code; a 40-character SHA cannot.
    for (const line of usesLines(text)) {
      expect(line).toMatch(/@[0-9a-f]{40} # v?\d+(\.\d+)*$/);
    }
  });

  it.each(workflows)('$name gives its token read access by default', ({ text }) => {
    expect(text).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  it.each(workflows)('$name never installs a package outside the lockfile', ({ text }) => {
    const code = text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
    expect(code).not.toMatch(/\bnpx\s+(--yes|-y)\b/);
  });

  it('wrangler-action uses an exact wrangler version', () => {
    for (const { text } of workflows.filter((w) => w.text.includes('wrangler-action'))) {
      expect(text).toMatch(/wranglerVersion: "\d+\.\d+\.\d+"/);
    }
  });

  it('checks npm registry signatures after installing', () => {
    const ci = workflows.find((w) => w.name === 'ci.yml')!.text;
    expect(ci).toContain('npm audit signatures');
  });

  it('Dependabot updates npm and actions on main, 7 days after a release', () => {
    expect(dependabot).toMatch(/package-ecosystem: "npm"/);
    expect(dependabot).toMatch(/package-ecosystem: "github-actions"/);
    // Work lands on main; the old dev branch has not moved since 2026-10-11.
    expect(dependabot).not.toMatch(/target-branch:/);
    const blocks = dependabot.split(/\n(?= {2}- package-ecosystem:)/).slice(1);
    for (const block of blocks) {
      expect(block).toMatch(/cooldown:\n {6}default-days: 7/);
    }
  });
});
