# V8 : champs natifs `alpha_liquid` et `enthalpy`

## Décision de modélisation

Le réseau V8 doit exposer sept sorties physiques : `rho`, `u`, `v`, `w`, `temperature`, `alpha_liquid` et `enthalpy`. La pression reste calculée par l’équation d’état à partir de `rho` et `temperature`, comme dans l’implémentation actuelle.

L’article fourni utilise une fraction volumique de vapeur `alpha_v` dans son modèle VOF, avec `alpha_l + alpha_v = 1` (p. 7–8, équations 5–10). Le contrat du projet utilise `alpha_liquid`, donc la conversion de référence est `alpha_liquid = 1 - alpha_v`. La densité et la viscosité de mélange doivent suivre les relations de mélange de l’article (p. 7, équations 6–7). L’énergie de mélange est une énergie massique moyenne (p. 7, équation 8) ; l’enthalpie doit être définie en `J/kg` à partir des propriétés thermodynamiques H2 retenues, et non par une constante arbitraire.

## Contrat V8 proposé

```json
{
  "inputOrder": ["t", "x", "y", "z"],
  "outputOrder": [
    "rho", "u", "v", "w", "temperature",
    "alpha_liquid", "enthalpy"
  ],
  "units": {
    "rho": "kg/m^3",
    "u": "m/s",
    "v": "m/s",
    "w": "m/s",
    "temperature": "K",
    "alpha_liquid": "1",
    "enthalpy": "J/kg"
  },
  "phaseConvention": {
    "reported": "alpha_liquid",
    "sourceConvention": "alpha_vapor",
    "relation": "alpha_liquid = 1 - alpha_vapor"
  },
  "thermodynamics": {
    "fluid": "hydrogen",
    "eos": "Silvera-Goldman-or-declared-reference",
    "propertySource": "NIST-or-CoolProp-versioned",
    "referenceEnthalpyK": 0.0
  },
  "evidence": {
    "fieldsProducedBySolver": true,
    "fieldsDerivedAfterInference": false,
    "unitsPersisted": true,
    "provenancePersisted": true
  }
}
```

Le modèle ne doit être accepté comme G3-ready que si `fieldsProducedBySolver` vaut `true` et que les champs ne sont pas ajoutés après l’inférence.

## Modifications du réseau

Dans `apps/api/pinn_3d_navier_stokes.py`, remplacer la sortie à cinq composantes par sept composantes. La couche finale doit donc être `7` :

```python
# [rho, u, v, w, T, alpha_logit, h_raw]
out = self.linears[-1](inp)

rho = torch.sigmoid(out[..., 0:1]) * RHO_SCALE + 0.1
u = torch.tanh(out[..., 1:2]) * U_SCALE
v = torch.tanh(out[..., 2:3]) * U_SCALE
w = torch.tanh(out[..., 3:4]) * U_SCALE
T = torch.sigmoid(out[..., 4:5]) * TEMP_SCALE + 13.8
alpha_liquid = torch.sigmoid(out[..., 5:6])
enthalpy = H_SCALE * torch.tanh(out[..., 6:7]) + H_REFERENCE

return rho, u, v, w, T, alpha_liquid, enthalpy
```

`H_SCALE` et `H_REFERENCE` doivent provenir du contrat thermodynamique. Ils ne doivent pas être choisis pour faire passer un test. Une autre option est de normaliser l’enthalpie par moyenne et écart-type issus du dataset et de persister ces valeurs.

## Modifications du modèle V8

Dans `apps/api/hydrogen_pinn_v8.py`, toutes les déstructurations du réseau doivent passer de cinq à sept sorties :

```python
rho, u, v, w, T, alpha_liquid, enthalpy = \\
    self.pinn_model(t_tensor, x_tensor, y_tensor, z_tensor)
```

La réponse batch doit retourner les champs natifs :

```python
results = {
    "pressure": p.detach().cpu().numpy().flatten(),
    "velocity_u": u.detach().cpu().numpy().flatten(),
    "velocity_v": v.detach().cpu().numpy().flatten(),
    "velocity_w": w.detach().cpu().numpy().flatten(),
    "temperature": T.detach().cpu().numpy().flatten(),
    "density": rho.detach().cpu().numpy().flatten(),
    "alpha_liquid": alpha_liquid.detach().cpu().numpy().flatten(),
    "enthalpy": enthalpy.detach().cpu().numpy().flatten(),
    "time": t.flatten(),
    "x": x.flatten(),
    "y": y.flatten(),
    "z": z.flatten(),
    "physics_audit": physics_status
}
```

Le champ `phaseFieldsDerived` du manifeste doit alors être `false`.

## Résidus supplémentaires

Dans `compute_residuals`, conserver les équations de continuité, quantité de mouvement et énergie, puis ajouter :

```python
alpha_t = self._safe_grad(alpha_liquid, t)
alpha_x = self._safe_grad(alpha_liquid, x)
alpha_y = self._safe_grad(alpha_liquid, y)
alpha_z = self._safe_grad(alpha_liquid, z)

alpha_transport = alpha_t + u * alpha_x + v * alpha_y + w * alpha_z

# fermeture thermodynamique : h prédit doit être cohérent avec T et alpha
h_equilibrium = self.thermo.mixture_enthalpy(
    temperature=T,
    alpha_liquid=alpha_liquid,
    rho=rho,
)
enthalpy_closure = enthalpy - h_equilibrium
```

Le modèle VOF de l’article conserve une équation de fraction de phase (p. 8, équation 10) et ajoute des termes de transfert de masse liquide-vapeur. Si aucun modèle de nucléation, d’évaporation ou de condensation n’est disponible, la première version peut imposer `alpha_transport = 0` comme cas sans transfert ; elle ne doit pas prétendre reproduire le boil-off de l’article.

La loss doit inclure :

```python
loss_phase = (alpha_transport ** 2).mean()
loss_enthalpy = (enthalpy_closure / H_SCALE).square().mean()
loss_bounds = (
    torch.relu(-alpha_liquid).square()
    + torch.relu(alpha_liquid - 1).square()
).mean()

loss_total = (
    w_pde * loss_pde
    + w_phase * loss_phase
    + w_enthalpy * loss_enthalpy
    + w_bounds * loss_bounds
    + w_data * loss_data
)
```

La valeur de `w_enthalpy` doit être persistée dans le contrat et réellement utilisée. Le champ actuel `loss_weights_applied: false` doit disparaître lorsque cette logique sera implémentée.

## Contrat Pydantic

Dans `TrainRequestV8`, modifier les valeurs par défaut :

```python
layers: List[int] = [4, 128, 128, 128, 128, 7]
output_order: List[str] = [
    "rho", "u", "v", "w", "temperature",
    "alpha_liquid", "enthalpy"
]
loss_weights: Dict[str, float] = {
    "pde": 1.0,
    "phase_transport": 1.0,
    "enthalpy_closure": 1.0,
    "bounds": 0.1,
    "data": 1.0
}
```

Le validateur doit refuser un contrat qui ne contient pas les deux champs :

```python
required = {"alpha_liquid", "enthalpy"}
if not required.issubset(set(self.output_order)):
    raise ValueError("V8 requires native alpha_liquid and enthalpy outputs")
if self.layers[-1] != len(self.output_order):
    raise ValueError("last layer must match output_order length")
```

Il faut aussi supprimer la condition actuelle qui impose implicitement cinq sorties dans les presets de l’API et du frontend.

## Réponse API

Étendre `PredictionResponseV8` :

```python
class PredictionResponseV8(BaseModel):
    pressure: float
    velocity_u: float
    velocity_v: float
    velocity_w: float
    temperature: float
    density: float
    alpha_liquid: float
    enthalpy: float
    time: float
    x: float
    y: float
    z: float
    physical_metrics: Optional[Dict] = None
    timestamp: str
```

La route batch doit vérifier que chaque tableau a la même longueur et qu’il est fini. Elle doit refuser un résultat qui ne contient pas `alpha_liquid` ou `enthalpy`, plutôt que de les dériver silencieusement.

## Persistance et manifeste

Le sidecar doit enregistrer :

```json
{
  "fields": [
    {"name": "rho", "unit": "kg/m^3", "origin": "solver_output"},
    {"name": "alpha_liquid", "unit": "1", "origin": "solver_output"},
    {"name": "enthalpy", "unit": "J/kg", "origin": "solver_output"}
  ],
  "phaseFieldsDerived": false,
  "g3Eligible": true,
  "thermodynamics": {
    "fluid": "H2",
    "propertySource": "NIST-or-CoolProp-versioned",
    "referenceEnthalpyK": 0.0
  }
}
```

`g3Eligible: true` ne doit être attribué que si le contrat physique, la provenance du modèle, les unités, la sortie native et les résidus sont tous présents. Le seul fait que les deux clés existent dans un VTU ne suffit pas.

## Tests obligatoires

Ajouter des tests qui vérifient :

1. la dernière couche vaut `7` ;
2. `alpha_liquid` est dans `[0, 1]` ;
3. `enthalpy` est fini et en `J/kg` ;
4. la réponse batch contient les deux champs ;
5. aucune route ne reconstruit ces champs après inférence ;
6. le résidu de fermeture d’enthalpie est persisté ;
7. un contrat avec cinq sorties est refusé pour le profil diphasique ;
8. une sortie marquée synthétique reste non validée.

## Relation avec le PDF fourni

Le PDF décrit un modèle VOF diphasique dans lequel la fraction volumique est une variable de phase, les propriétés de mélange dépendent des fractions, et l’équation d’énergie utilise une énergie de mélange massique (pp. 7–8, équations 5–17). Il décrit aussi une condition initiale de saturation de l’hydrogène à 20,268 K et une pression atmosphérique (p. 9), mais ces conditions ne doivent être utilisées que si elles correspondent au contrat LH2 exact du projet.

L’article ne fournit pas à lui seul un dataset point par point permettant d’entraîner V8. Il sert de référence de formulation et de conditions, pas de poids de modèle ni de preuve de validation pour cette géométrie.
