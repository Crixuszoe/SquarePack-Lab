# SquarePack Lab

**Computational Geometry Laboratory & High-Throughput Solver for Unit-Square Packing Optimization ($n = 1$ to $1,000$).**

Developed for unit-square container packing competitions (e.g. Kaggle / computational geometry challenges).

---

## Competition Objective

For each integer $n \in [1, 1000]$, place $n$ unit squares inside the smallest possible axis-aligned square container:
- Each unit square has center coordinates $(x, y)$ and rotation angle $\theta$ in radians.
- Side length is exactly $1$.
- Square interiors must not overlap (boundary contact is permitted).
- Container side length $L = \max(x_{\max} - x_{\min}, y_{\max} - y_{\min})$.
- Score for each puzzle:
  $$\text{score}(n) = \frac{L}{\sqrt{n}} - 1$$
- Total competition score: sum across all 1,000 puzzles:
  $$\text{Total Score} = \sum_{n=1}^{1000} \text{score}(n)$$

Lower is better. A baseline grid achieves provisional fallback $L_{\text{grid}} = \lceil\sqrt{n}\rceil$. For perfect squares ($n = m^2$), the baseline grid reaches the theoretical area lower bound $L = \sqrt{n}$ with $\text{score} = 0$ (proven optimal).

---

## Key Features

1. **Interactive Rotated Geometry Canvas**:
   - High-DPI canvas with smooth panning, zooming, and fit-to-view.
   - Rotated unit square rendering with center points and orientation pointers.
   - Live bounding container display showing width $W$, height $H$, and $L = \max(W, H)$.
   - Real-time collision highlighting for overlapping squares.
   - Hover inspector displaying square ID, center $(x, y)$, angle in radians and degrees, and AABB extents.

2. **5-Point Independent Geometry Validator**:
   - Recomputes all geometry from scratch directly from raw coordinate values (never trusts solver cache).
   - Verifies:
     1. Exact square count ($n$).
     2. Sequential IDs from $0$ to $n-1$ without duplicates.
     3. Strict finite numeric coordinates (no `NaN` / `Infinity`).
     4. Separating Axis Theorem (SAT) interior overlap $\le 10^{-8}$.
     5. Container Height ($H$) and Width ($W$) bounding check ($H \le L$ and $W \le L$).

3. **Multi-Heuristic Optimization Engine**:
   - Progressive Container Shrinkage with Simulated Annealing.
   - Physics-directed collision repulsion: pushes overlapping squares along repulsive force vectors rather than relying solely on random diffusion.
   - Discrete canonical angle snaps (45°, 30°, 60°) and boundary centroid compaction.
   - Reproducible seeds (Mulberry32 PRNG), configurable time budgets, restarts, and step sizes.
   - Batch optimizer across ranges (automatically skipping the 31 proven-optimal perfect squares).

4. **Analytical High-Density Patterns**:
   - 5-Square Diamond ($L = 2 + 1/\sqrt{2} \approx 2.7071$ vs baseline $L = 3.0$).
   - 10-Square Perimeter Ring-Core packing ($L \approx 3.714$ vs baseline $L = 4.0$).
   - Tilted crystal lattice search across continuous angles $\theta \in [0, \pi/4]$.

5. **Submission CSV Pipeline & Round-Trip Verification**:
   - Exports compliant CSV with columns: `id,n,square_id,x,y,angle`.
   - Full 1,000-puzzle submission (500,500 rows) or partial submissions.
   - **In-memory round-trip pre-download check**: re-parses the generated CSV and validates all 500,500 rows with independent SAT checks before offering the download.

6. **Offline Python & Kaggle Solver**:
   - Standalone script `squarepack_solver.py` with multi-core CLI options (`--full`, `--range`, `--budget`, `--seed`).
   - Run overnight on Kaggle GPUs/CPUs, then import the resulting CSV into SquarePack Lab.

7. **IndexedDB Local Persistence**:
   - Automatically saves and restores best validated solutions across browser sessions.
   - JSON checkpoint backup and restore.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/Crixuszoe/SquarePack-Lab.git
cd SquarePack-Lab

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Standalone Python Solver (Kaggle / Local)

```bash
# Install numpy
pip install numpy

# Run optimization on single puzzle (e.g. n=5 with 30s budget)
python squarepack_solver.py --n 5 --budget 30 --out submission_n5.csv

# Run optimization across a range (e.g. n=2 to 25)
python squarepack_solver.py --range 2 25 --budget 10 --out submission_range.csv

# Run full competition optimization (all 1,000 puzzles)
python squarepack_solver.py --full --budget 15 --out submission_full.csv
```

---

## License

Apache-2.0
