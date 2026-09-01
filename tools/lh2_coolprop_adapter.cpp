#include <cmath>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include "CoolProp/CoolPropLib.h"

namespace {
thread_local std::string lastError;
std::mutex coolpropMutex;

bool finite(double x) { return std::isfinite(x); }

double query(const char* output, const char* name1, double value1,
             const char* name2, double value2)
{
    std::lock_guard<std::mutex> lock(coolpropMutex);
    char fluid[] = "ParaHydrogen";
    const double value = PropsSI(output, name1, value1, name2, value2, fluid);
    char error[2048] = {};
    get_global_param_string("errstring", error, sizeof(error));
    if (!finite(value) || error[0] != '\0') {
        lastError = error[0] ? error : "CoolProp returned a non-finite value";
        return NAN;
    }
    lastError.clear();
    return value;
}
}

extern "C" {

double lh2_temperature_from_ph(double p_Pa, double h_J_kg)
{ return query("T", "P", p_Pa, "H", h_J_kg); }

double lh2_density_from_ph(double p_Pa, double h_J_kg)
{ return query("D", "P", p_Pa, "H", h_J_kg); }

double lh2_internal_energy_from_ph(double p_Pa, double h_J_kg)
{ return query("U", "P", p_Pa, "H", h_J_kg); }

double lh2_cp_from_ph(double p_Pa, double h_J_kg)
{ return query("C", "P", p_Pa, "H", h_J_kg); }

double lh2_viscosity_from_ph(double p_Pa, double h_J_kg)
{ return query("V", "P", p_Pa, "H", h_J_kg); }

double lh2_conductivity_from_ph(double p_Pa, double h_J_kg)
{ return query("L", "P", p_Pa, "H", h_J_kg); }

double lh2_quality_from_ph(double p_Pa, double h_J_kg)
{ return query("Q", "P", p_Pa, "H", h_J_kg); }

double lh2_saturation_temperature(double p_Pa)
{ return query("T", "P", p_Pa, "Q", 0.0); }

double lh2_saturation_pressure(double T_K)
{ return query("P", "T", T_K, "Q", 0.0); }

const char* lh2_last_error()
{ return lastError.c_str(); }

}
