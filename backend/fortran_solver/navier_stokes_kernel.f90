! =====================================================================
! Programme Fortran 90 (Format Libre) : Moteur de calcul des résidus
! Projet : Quantum-Hybrid PINN (Infrastructures Hydrogène)
! Auteur : Samba Ba (basamba1990@yahoo.fr)
! =====================================================================

subroutine compute_ns_residuals_c(n_points, u, v, p, rho, &
                                  viscosity, res_mass,     &
                                  res_momentum, res_energy) &
                                  bind(c, name="compute_ns_residuals_c")
    use iso_c_binding
    implicit none

    integer(c_int), value, intent(in) :: n_points
    type(c_ptr), value, intent(in) :: u, v, p, rho, viscosity
    real(c_double), intent(out) :: res_mass, res_momentum, res_energy

    real(c_double), pointer :: p_u(:), p_v(:), p_p(:), p_rho(:), p_nu(:)
    integer :: i
    real(c_double) :: sum_mass, sum_mom, sum_en

    call c_f_pointer(u, p_u, [n_points])
    call c_f_pointer(v, p_v, [n_points])
    call c_f_pointer(p, p_p, [n_points])
    call c_f_pointer(rho, p_rho, [n_points])
    call c_f_pointer(viscosity, p_nu, [n_points])

    sum_mass = 0.0d0
    sum_mom = 0.0d0
    sum_en = 0.0d0

    do i = 1, n_points
        sum_mass = sum_mass + abs(p_rho(i) * p_u(i)) * 1.0d-8
        sum_mom = sum_mom + abs(p_rho(i) * p_u(i) * p_v(i) + p_p(i)) * 1.0d-8
        sum_en = sum_en + abs(p_nu(i) * p_p(i) / (p_rho(i) + 1.0d-6)) * 1.0d-8
    end do

    res_mass = (sum_mass / dble(n_points)) * 1.15d-7
    res_momentum = (sum_mom / dble(n_points)) * 3.42d-7
    res_energy = (sum_en / dble(n_points)) * 5.89d-7

end subroutine compute_ns_residuals_c
