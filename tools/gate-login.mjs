/* Getting a build script past the site gate, without the password going
   anywhere it can be read later.

   GATE_PW lives in Vercel as an encrypted variable and stays there. It cannot
   be pulled back out — `vercel env pull` writes the key with an empty value —
   and that is the point rather than an obstacle to route around.

   So a script that needs the deployed function asks for the password at the
   terminal and holds it in memory for the length of one run. Typed rather than
   passed as an environment variable, because `GATE_PW=… node tool.mjs` puts
   the password in shell history, in the process list while it runs, and in any
   transcript of the session. Typed at a muted prompt it lands in none of them.

   GATE_PW is still read from the environment when it is set, for CI, and when
   stdin is not a terminal there is nothing to prompt.                        */

import { createInterface } from 'node:readline';

/** Ask at the terminal without echoing. Returns '' if there is no terminal. */
export function askSecret(prompt) {
  if (!process.stdin.isTTY) return Promise.resolve('');
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const answer = new Promise(res => rl.question(prompt, res));
    /* Overridden AFTER question() so the prompt itself is printed and
       everything typed after it is not. */
    rl._writeToOutput = () => {};
    answer.then(v => {
      process.stdout.write('\n');
      rl.close();
      resolve(String(v));
    });
  });
}

/**
 * Unlock the deployment and return the cookie to send with later requests.
 * @returns {Promise<string>} the cookie, or '' when the deployment has no gate
 */
export async function gateLogin(base) {
  const password = process.env.GATE_PW || await askSecret(`Gate password for ${base}: `);

  const r = await fetch(`${base}/api/gate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password, remember: false })
  });

  const j = await r.json().catch(() => ({}));

  /* GATE_PW unset on this deployment — middleware fails open, so there is
     nothing to unlock and no cookie to carry. True of preview deployments
     here, where GATE_PW is not configured. */
  if (r.ok && j.open) return '';

  if (r.status === 401) {
    throw new Error('that password did not match the deployment');
  }
  if (!r.ok) throw new Error(`the gate returned ${r.status}`);

  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('the gate accepted the password but set no cookie');
  return cookie;
}

/** POST to the Gemini function with the unlocked cookie. */
export async function callGemini(base, cookie, body) {
  const r = await fetch(`${base}/api/gemini`, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, cookie ? { cookie } : {}),
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `gemini returned ${r.status}`);
  return j;
}
