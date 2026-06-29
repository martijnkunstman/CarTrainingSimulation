import { NeuralNetwork } from './nn.js';

export class GeneticAlgorithm {
  constructor({ popSize = 8, eliteCount = 2, mutationRate = 0.12, mutationStrength = 0.35 } = {}) {
    this.popSize          = popSize;
    this.eliteCount       = eliteCount;
    this.mutationRate     = mutationRate;
    this.mutationStrength = mutationStrength;
    this.generation       = 0;
    this.fitnessHistory   = []; // { best, avg } per generation

    this.networks = Array.from({ length: popSize }, () => new NeuralNetwork());
  }

  // Advance one generation given parallel fitness scores; returns new networks array
  nextGeneration(fitnesses) {
    const best = Math.max(...fitnesses);
    const avg  = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    this.fitnessHistory.push({ best, avg });
    this.generation++;

    // Rank by fitness descending
    const ranked = fitnesses
      .map((f, i) => ({ f, i }))
      .sort((a, b) => b.f - a.f);

    const next = [];

    // Elites carry over unchanged
    for (let e = 0; e < this.eliteCount; e++) {
      next.push(this.networks[ranked[e].i].clone());
    }

    // Fill rest via crossover + mutation from top half
    const parentPool = ranked.slice(0, Math.max(2, Math.ceil(this.popSize / 2)));
    while (next.length < this.popSize) {
      const pA = this.networks[parentPool[Math.floor(Math.random() * parentPool.length)].i];
      const pB = this.networks[parentPool[Math.floor(Math.random() * parentPool.length)].i];
      const child = new NeuralNetwork();
      child.genome = NeuralNetwork.crossover(pA.genome, pB.genome);
      NeuralNetwork.mutate(child.genome, this.mutationRate, this.mutationStrength);
      next.push(child);
    }

    this.networks = next;
    return this.networks;
  }
}
