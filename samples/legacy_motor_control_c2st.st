TYPE MotorStatus :
STRUCT
    running : BOOL; // 0 = stopped, 1 = running
    current_amps : REAL; // Motor current in Amps
    temperature : REAL; // Celsius
    fault_code : UINT; // 0 = OK, >0 = fault
    mode : USINT; // 0=Idle, 1=Run, 2=Fault, 3=Maintenance
END_STRUCT
END_TYPE

FUNCTION scale_analog_value : REAL
VAR_INPUT
    raw_adc : INT;
    raw_min : INT;
    raw_max : INT;
    eu_min : REAL;
    eu_max : REAL;
END_VAR
VAR
    result : REAL;
END_VAR
// Avoid divide by zero
IF raw_max = raw_min THEN
    scale_analog_value := eu_min;
ELSE
    result := REAL_TO_REAL(raw_adc - raw_min) * (eu_max - eu_min) / REAL_TO_REAL(raw_max - raw_min) + eu_min;
    scale_analog_value := result;
END_IF
END_FUNCTION

FUNCTION average_temperatures : REAL
VAR_INPUT
    temp_buffer : ARRAY[0..9] OF REAL; // Fixed size array for safety
    num_samples : INT;
END_VAR
VAR
    sum : REAL := 0.0;
    i : INT;
END_VAR

FOR i := 0 TO num_samples - 1 DO
    sum := sum + temp_buffer[i];
END_FOR

IF num_samples > 0 THEN
    average_temperatures := sum / REAL_TO_REAL(num_samples);
ELSE
    average_temperatures := 0.0;
END_IF
END_FUNCTION

FUNCTION_BLOCK FB_MotorControl
VAR_INPUT
    start_command : BOOL;
    stop_command : BOOL;
    raw_current_adc : INT;
END_VAR
VAR_IN_OUT
    motor : MotorStatus; // Replaces pointer to struct
END_VAR
VAR RETAIN
    total_runtime_seconds : UDINT := 0; // Persists between calls
END_VAR

// Read current from ADC and scale to Amps
motor.current_amps := scale_analog_value(raw_current_adc, 0, 4095, 0.0, 50.0);

// State machine using CASE OF
CASE motor.mode OF
    0: // IDLE
        motor.running := FALSE;
        motor.fault_code := 0;
        IF start_command THEN
            motor.mode := 1; // Go to RUN
        END_IF

    1: // RUNNING
        motor.running := TRUE;
        total_runtime_seconds := total_runtime_seconds + 1; // Accumulate runtime

        // Check for overcurrent fault
        IF motor.current_amps > 15.0 THEN
            motor.fault_code := 101; // Overcurrent
            motor.mode := 2; // Go to FAULT
        // Check for overtemp fault
        ELSIF motor.temperature > 85.0 THEN
            motor.fault_code := 102; // Overtemp
            motor.mode := 2; // Go to FAULT
        // Check stop command
        ELSIF stop_command THEN
            motor.mode := 0; // Go to IDLE
        END_IF

    2: // FAULT
        motor.running := FALSE;
        // Stay in fault until reset - maintenance mode clears it

    3: // MAINTENANCE
        motor.running := FALSE;
        motor.fault_code := 0; // Clear faults in maintenance

    ELSE // Unknown state - safety
        motor.mode := 2; // Force to fault
        motor.running := FALSE;
        motor.fault_code := 999; // Invalid state
END_CASE
END_FUNCTION_BLOCK

(*
=== C2ST Notes ===
- Replaced C struct with TYPE...STRUCT for MotorStatus, using IEC 61131-3 data types (BOOL, REAL, UINT, USINT)
- Converted static variable to VAR RETAIN for persistent storage between calls
- Replaced pointer parameter with VAR_IN_OUT in FUNCTION_BLOCK to safely pass MotorStatus struct
- Used fixed-size ARRAY[0..9] for temperature buffer to avoid dynamic memory allocation
- Implemented state machine with CASE OF instead of C switch, removing need for break statements
- Added explicit type conversions (REAL_TO_REAL) to ensure safe arithmetic operations
*)