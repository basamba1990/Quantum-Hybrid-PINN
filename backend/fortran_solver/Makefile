FC = gfortran
FFLAGS = -O3 -fPIC -shared

TARGET = libns_solver.so
SRC = navier_stokes_kernel.f90

all: $(TARGET)

$(TARGET): $(SRC)
	$(FC) $(FFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.mod navier_stokes_kernel.f95
