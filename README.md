# Carbon-Aware Route Optimization in Supply Chain Networks Using Machine Learning and Genetic Algorithms

## 🌍 Overview
This framework integrates Machine Learning (an ensemble of Random Forest and XGBoost) with the NSGA-II Genetic Algorithm to optimize transportation routes. It balances the critical trade-off between reducing carbon emissions and managing operational costs within global supply chain networks.

### Key Results
* **ML Performance:** Achieved 9.48% MAPE and 0.928 R² for emission prediction.
* **Synthetic Experiments:** Demonstrated a 19.5% average emission reduction against a 4.7% cost increase across 3,500 modeled routes.
* **Real-World Case Study:** Achieved a **41.4% emission reduction** with only an 8.6% cost increase (Salamanca network, n=12 major routes).

---

## ⚙️ Features
* **Predictive Emissions Engine:** Utilizes gradient boosting and random forest architectures to accurately predict carbon output across multiple transport modes.
* **Multi-Objective Optimization:** Uses the NSGA-II genetic algorithm to generate Pareto fronts, identifying optimal shifts in transportation modes (e.g., Road to Rail).
* **Physics-Based Features:** Incorporates distance normalization, cargo weight interactions, and origin-destination embeddings.
* **Real-World Data Integration:** Built to utilize real-world emission factors from the EPA and Climatiq APIs.

---

## 💻 Step-by-Step Guide to Run Locally on Your Laptop

Follow these exact steps to run the code on your personal machine (Windows, macOS, or Linux).

### Step 1: Clone the Repository
First, download the code to your laptop. Open your Terminal (Mac/Linux) or Command Prompt/PowerShell (Windows) and run:
```bash
git clone [https://github.com/lspusal/carbon-aware-route-optimization.git](https://github.com/lspusal/carbon-aware-route-optimization.git)
