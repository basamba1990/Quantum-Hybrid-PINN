#ifndef lh2RanzMarshallSource_H
#define lh2RanzMarshallSource_H

#include "fvModel.H"
#include "volFields.H"
#include "fvMatrices.H"

namespace Foam
{
namespace fv
{
class lh2RanzMarshallSource : public fvModel
{
    scalar Cevap_, Ccond_, kLiquid_, diameter_, reynolds_, prandtl_, hfg_, tsat0_, tsatSlope_;
    word alphaName_, temperatureName_, pressureName_, rho1Name_, rho2Name_;
    mutable autoPtr<volScalarField> mDotEvapPtr_, mDotCondPtr_;

    scalar tsat(const scalar p) const;
    scalar nu() const;
    scalar areaDensity(const scalar alpha) const;
    scalar correction(const scalar alpha) const;
    void calculate() const;
    void writeDiagnostics() const;

public:
    TypeName("lh2RanzMarshallSource");

    lh2RanzMarshallSource
    (
        const word& name,
        const word& modelType,
        const fvMesh& mesh,
        const dictionary& dict
    );

    virtual wordList addSupFields() const;
    virtual void addSup(const volScalarField& field, fvMatrix<scalar>& eqn) const;
    virtual void addSup(const volScalarField& rho, const volScalarField& field, fvMatrix<scalar>& eqn) const;
    virtual void addSup(const volScalarField& alpha, const volScalarField& rho, const volScalarField& field, fvMatrix<scalar>& eqn) const;
    virtual bool movePoints();
    virtual void topoChange(const polyTopoChangeMap& map);
    virtual void mapMesh(const polyMeshMap& map);
    virtual void distribute(const polyDistributionMap& map);
};
}
}

#endif
