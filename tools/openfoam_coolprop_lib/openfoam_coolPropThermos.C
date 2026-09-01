#include "rhoThermo.H"
#include "makeThermo.H"
#include "thermo.H"
#include "pureMixture.H"
#include "specie.H"
#include "icoTabulated.H"
#include "constTransport.H"
#include "sensibleEnthalpy.H"
#include "heRhoThermo.H"
#include "openfoam_coolPropThermo.H"

namespace Foam
{

makeThermos
(
    rhoThermo,
    heRhoThermo,
    pureMixture,
    constTransport,
    sensibleEnthalpy,
    coolPropThermo,
    icoTabulated,
    specie
);

}
