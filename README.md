# It's Knot Fun

An interactive simulation exploring the topology and physics of three-dog leash tangling, grounded in braid theory and Position-Based Dynamics.

## What This Is

Anyone who has walked multiple dogs knows the frustration: leashes tangle. With two dogs, it's trivial to fix. With three dogs, you enter the realm of non-abelian braid groups, and untangling becomes genuinely hard.

This project simulates:

1. A walker with three dogs on leashes
2. Real-time rope physics using Position-Based Dynamics (PBD)
3. Automatic detection and tracking of leash crossings
4. Braid word generation (the mathematical representation of the tangle)
5. Tangle complexity metrics

The end goal: not just simulating tangles, but solving them algorithmically.

## The Mathematics

The three-dog leash problem maps directly to the braid group B3:

```
B3 = <sigma1, sigma2 | sigma1*sigma2*sigma1 = sigma2*sigma1*sigma2>
```

This is the Yang-Baxter equation, fundamental to quantum computing and statistical mechanics. Every crossing generates a braid word element, and the current tangle state is the accumulated word.

Key concepts:
- sigma1: Dog B crosses over Dog A
- sigma2: Dog C crosses over Dog B
- Inverse operations represent under-crossings
- The Yang-Baxter relation allows some simplifications
- Finding the shortest equivalent word is NP-hard

## Technical Approach

### Physics Engine
- Verlet integration for particle simulation
- Position-Based Dynamics for constraint solving
- Gauss-Seidel iteration (5-10 iterations for real-time performance)
- Segment-segment distance calculation for crossing detection

### Braid Tracking
- Real-time crossing detection between leash segments
- Braid word accumulation with automatic simplification
- Writhe and complexity metrics
- Garside normal form for canonical representation

### Rendering
- Top-down suburban sidewalk view
- Animated walker with human gait cycle
- Three dogs with quadruped locomotion and AI behaviors
- Visual distinction of over/under crossings

## Running Locally

Open `index.html` in a browser. No build step required.

For development with live reload:
```bash
npx serve .
```

## Project Structure

```
itsknotfun/
├── index.html          # Main page
├── styles.css          # Stylesheet
├── js/
│   ├── vector.js       # 2D vector math and segment utilities
│   ├── physics.js      # PBD rope simulation
│   ├── braid.js        # Braid word tracking and simplification
│   ├── entities.js     # Walker and Dog classes
│   ├── renderer.js     # Canvas rendering
│   ├── simulation.js   # Main simulation loop
│   └── main.js         # Entry point and UI
└── assets/             # Sprites and images
```

## Future: Untangling Algorithms

Once tangling is working, the next phase is implementing solvers:

1. Greedy heuristics (writhe minimization, nearest-neighbor)
2. Garside normal form reduction
3. A* search with tangle complexity heuristic
4. Possibly learned heuristics via reinforcement learning

## References

- Artin, E. (1947). "Theory of Braids." Annals of Mathematics
- Muller et al. (2006). "Position-Based Dynamics"
- Garside, F.A. (1969). "The braid group and other groups"
- Birman, J. (1974). Braids, Links, and Mapping Class Groups

## License

MIT
