import { loadAgentConfig, env } from './config';
import { startLoop, stopLoop } from './orchestrator/loop';

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log(' LiveClaw Generic Agent Runtime');
  console.log('═══════════════════════════════════════════');
  console.log(`API: ${env.apiBaseUrl}`);
  console.log(`Agent ID: ${env.agentId}`);
  console.log('');

  // Load agent config from API
  const config = await loadAgentConfig();

  console.log('');
  console.log(`Agent: ${config.name} (${config.slug})`);
  console.log(`LLM: ${config.llm.provider} / ${config.llm.model}`);
  console.log(`Voice: ${config.voice.ttsVoice} (${env.voiceDisabled ? 'DISABLED' : 'enabled'})`);
  console.log(`Tick: ${config.tickInterval}ms | Idle: ${config.idleIntervalMin / 1000}-${config.idleIntervalMax / 1000}s`);
  console.log('');

  // Start the main loop
  await startLoop();

  console.log('═══════════════════════════════════════════');
  console.log(` ${config.name} is LIVE`);
  console.log('═══════════════════════════════════════════');

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Shutdown] Stopping...');
    stopLoop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
