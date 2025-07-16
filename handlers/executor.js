// src/handlers/executor.js
import actions from './actions.js';

// Important note to future dev:
// Code 7 is used for ending the monologue system of cassitydev.

export async function executeIntent(intentPayload, msg = null, client = null) {
  const { intent, args = {}, safety_check = true } = intentPayload;

  if (!safety_check) return { status: 'error', message: 'Safety check failed or not allowed.' };

  const action = actions[intent];
  if (!action) return { status: 'error', message: `Unknown intent: ${intent}` };

  try {
    const context = { msg, client };
    const result = await action(args, context);
    if (result.code === 0) return { status: 'success', data: result };
    else if (result.code === 1) return { status: 'failure', data: result };
    else {
      return { ...result }
    }
  } catch (error) {
    return { status: 'error', message: `Execution failed: ${error.message}` };
  }
}
