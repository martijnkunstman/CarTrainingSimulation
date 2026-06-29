// NeuralNetwork: 10 inputs → 16 hidden (tanh) → 4 outputs (tanh)
// Genome layout: [w_ih (I×H), b_h (H), w_ho (H×O), b_o (O)]

export class NeuralNetwork {
  constructor(inputSize = 10, hiddenSize = 16, outputSize = 4) {
    this.inputSize  = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    const n = inputSize * hiddenSize + hiddenSize + hiddenSize * outputSize + outputSize;
    this.genome = new Float32Array(n);
    for (let i = 0; i < n; i++) this.genome[i] = (Math.random() * 2 - 1) * 0.5;
  }

  forward(inputs) {
    const { inputSize: I, hiddenSize: H, outputSize: O, genome: g } = this;

    // Hidden layer
    const hidden = new Float32Array(H);
    for (let h = 0; h < H; h++) {
      let sum = g[I * H + h]; // bias
      for (let i = 0; i < I; i++) sum += g[h * I + i] * inputs[i];
      hidden[h] = Math.tanh(sum);
    }

    // Output layer
    const base = I * H + H;
    const output = new Float32Array(O);
    for (let o = 0; o < O; o++) {
      let sum = g[base + H * O + o]; // bias
      for (let h = 0; h < H; h++) sum += g[base + o * H + h] * hidden[h];
      output[o] = Math.tanh(sum);
    }

    return output;
  }

  // Returns hidden activations alongside outputs (for visualizer)
  forwardDetailed(inputs) {
    const { inputSize: I, hiddenSize: H, outputSize: O, genome: g } = this;

    const hidden = new Float32Array(H);
    for (let h = 0; h < H; h++) {
      let sum = g[I * H + h];
      for (let i = 0; i < I; i++) sum += g[h * I + i] * inputs[i];
      hidden[h] = Math.tanh(sum);
    }

    const base = I * H + H;
    const output = new Float32Array(O);
    for (let o = 0; o < O; o++) {
      let sum = g[base + H * O + o];
      for (let h = 0; h < H; h++) sum += g[base + o * H + h] * hidden[h];
      output[o] = Math.tanh(sum);
    }

    return { inputs: Array.from(inputs), hidden: Array.from(hidden), outputs: Array.from(output) };
  }

  clone() {
    const nn = new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize);
    nn.genome.set(this.genome);
    return nn;
  }

  static mutate(genome, rate = 0.12, strength = 0.35) {
    for (let i = 0; i < genome.length; i++) {
      if (Math.random() < rate) genome[i] += (Math.random() * 2 - 1) * strength;
    }
  }

  static crossover(a, b) {
    const child = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) child[i] = Math.random() < 0.5 ? a[i] : b[i];
    return child;
  }
}
