# Contributing to Quantum-Hybrid-PINN

We love your input! We want to make contributing as easy and transparent as possible.

## How to Contribute

1. Fork the repo and create your branch from `development`.
2. If you add code, add tests.
3. Ensure the test suite passes.
4. Make sure your code lints (`pnpm lint`).
5. Issue that pull request!

## Code of Conduct

Please use respectful, constructive language. We aim to be a welcoming community.

## Reporting Issues

Use GitHub issues – include a minimal reproducible example and describe what you expected vs what happened.

## Adding Physics or Models

- Place new PINN/FNO models in `apps/api/models/`
- Update `apps/api/loss_functions.py` with new residual terms (mass, momentum, energy)
- Provide a short notebook in `notebooks/` validating against a known CFD benchmark

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
