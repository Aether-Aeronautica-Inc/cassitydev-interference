import fetch from 'node-fetch';

export async function triggerTraining() {
  try {
    const res = await fetch('http://localhost:11434/train', {
      method: 'POST'
    });
    const json = await res.json();
    console.log('[Train Trigger]', json);
    return json;
  } catch (err) {
    console.error('[Train Trigger Error]', err);
    return { status: '❌ Error', error: err.message };
  }
}

triggerTraining();