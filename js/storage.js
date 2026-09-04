import { NeuralNetwork } from './nn.js';
import { NN_INPUT_SIZE, NN_HIDDEN_SIZE, NN_OUTPUT_SIZE } from './config.js';

const KEY = 'carTrainingSave';

// Serialize current GA state to a plain object
export function buildSaveData(ga, bestEver) {
  return {
    generation:     ga.generation,
    bestEver,
    fitnessHistory: ga.fitnessHistory,
    networks: ga.networks.map(nn => ({
      inputSize:  nn.inputSize,
      hiddenSize: nn.hiddenSize,
      outputSize: nn.outputSize,
      genome:     Array.from(nn.genome),  // Float32Array → plain array for JSON
    })),
  };
}

export function save(ga, bestEver) {
  try {
    localStorage.setItem(KEY, JSON.stringify(buildSaveData(ga, bestEver)));
  } catch (e) {
    console.warn('Training save failed:', e);
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Discard saves from a previous, incompatible network architecture
    // (e.g. after changing sensor count or hidden layer size) instead of
    // feeding mismatched-length genomes into the current NeuralNetwork shape.
    const shapeMatches = data.networks.every(n =>
      n.inputSize === NN_INPUT_SIZE && n.hiddenSize === NN_HIDDEN_SIZE && n.outputSize === NN_OUTPUT_SIZE
    );
    if (!shapeMatches) {
      console.warn('Training save uses a different network architecture — starting fresh.');
      return null;
    }

    const networks = data.networks.map(n => {
      const nn = new NeuralNetwork(n.inputSize, n.hiddenSize, n.outputSize);
      nn.genome = new Float32Array(n.genome);
      return nn;
    });

    return {
      generation:     data.generation,
      bestEver:       data.bestEver ?? 0,
      fitnessHistory: data.fitnessHistory ?? [],
      networks,
    };
  } catch (e) {
    console.warn('Training load failed:', e);
    return null;
  }
}

export function hasSave() {
  return localStorage.getItem(KEY) !== null;
}

export function clearSave() {
  localStorage.removeItem(KEY);
}

const WINNER_KEY = 'carTrainingWinner';

export function saveWinner(nn, generation) {
  try {
    localStorage.setItem(WINNER_KEY, JSON.stringify({
      generation,
      inputSize:  nn.inputSize,
      hiddenSize: nn.hiddenSize,
      outputSize: nn.outputSize,
      genome:     Array.from(nn.genome),
    }));
  } catch (e) {
    console.warn('Winner save failed:', e);
  }
}

export function loadWinner() {
  try {
    const raw = localStorage.getItem(WINNER_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { generation, inputSize, hiddenSize, outputSize, genome[] }
  } catch (e) {
    console.warn('Winner load failed:', e);
    return null;
  }
}

// Returns a human-readable summary of the stored save (for UI display)
export function saveSummary() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { generation: data.generation, bestEver: data.bestEver ?? 0 };
  } catch {
    return null;
  }
}
