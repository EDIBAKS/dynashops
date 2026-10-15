// Usage: npm run deploy:web -- "commit message"
// Builds to verify, commits everything, pushes to GitHub (Netlify redeploys on push).
import { execSync } from 'node:child_process'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const message = process.argv.slice(2).join(' ') || `Update ${new Date().toISOString().slice(0, 16)}`

run('npm run build')
run('git add -A')
try {
  execSync('git diff --cached --quiet')
  console.log('Nothing new to commit.')
} catch {
  run(`git commit -m "${message.replace(/"/g, '\\"')}"`)
}
run('git push origin HEAD')
console.log('Pushed. Netlify will redeploy automatically.')
