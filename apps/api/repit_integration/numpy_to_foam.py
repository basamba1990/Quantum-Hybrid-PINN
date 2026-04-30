def include_all_features_NC(
    temperature_data: np.ndarray,
    latestML_time_dir: Path,
    velocity_data: np.ndarray,
    adjust_phi: bool = True,
) -> str:
    pressure_path = latestML_time_dir / "p"
    assert pressure_path, '''You must have "pressure file"'''
    pressure_data = Ofpp.parse_internal_field(str(pressure_path))
    rho_data = calculate_rho(pressure_data, temperature_data)
    for file in latestML_time_dir.iterdir():
        if file == latestML_time_dir / "rho":
            data_str = "(\n" + parse_numpy(rho_data) + "\n)\n;"
            with open(file, "r") as f:
                foam_data = f.read()
                foam_data = re.sub(r'\([\s\S]*?\)\n;', f"{data_str}", foam_data, count=1)
            with open(file, "w") as f:
                f.write(foam_data)

    if adjust_phi:
        # ========== PATCH 5 : Remplacer adjustPhiML par adjustPhi standard ==========
        command_to_adjustPhi = ["adjustPhi", "-case", str(latestML_time_dir.parent), "-time", latestML_time_dir.name]
        try:
            return subprocess.run(command_to_adjustPhi, check=True, capture_output=True, text=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("adjustPhi command failed or not found. Continuing without flux adjustment.")
            return "adjustPhi command failed or not found."
    return "Done!"
