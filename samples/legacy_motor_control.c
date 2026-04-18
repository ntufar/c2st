/*
 * Legacy Motor Control Module
 * Typical C code found in older embedded control systems
 * Good test case for C -> PLC Structured Text conversion
 */

#include <stdint.h>

// Motor status structure - common in C control code
typedef struct {
    uint8_t running; // 0 = stopped, 1 = running
    float current_amps; // Motor current in Amps
    float temperature; // Celsius
    uint16_t fault_code; // 0 = OK, >0 = fault
    uint8_t mode; // 0=Idle, 1=Run, 2=Fault, 3=Maintenance
} MotorStatus;

// Static variable persists between calls - like RETAIN in ST
static uint32_t total_runtime_seconds = 0;

// Function to scale raw ADC to engineering units
float scale_analog_value(int raw_adc, int raw_min, int raw_max, float eu_min, float eu_max) {
    float result;
    if (raw_max == raw_min) {
        return eu_min; // Avoid divide by zero
    }
    result = (float)(raw_adc - raw_min) * (eu_max - eu_min) / (float)(raw_max - raw_min) + eu_min;
    return result;
}

// Process array of temperature samples - pointer example
float average_temperatures(float *temp_buffer, int num_samples) {
    float sum = 0.0;
    int i;

    for (i = 0; i < num_samples; i++) {
        sum = sum + temp_buffer[i]; // or *(temp_buffer + i)
    }

    if (num_samples > 0) {
        return sum / (float)num_samples;
    } else {
        return 0.0;
    }
}

// Main motor control logic - uses switch/case state machine
void update_motor_control(MotorStatus *motor, int start_command, int stop_command, int raw_current_adc) {

    // Read current from ADC and scale to Amps
    motor->current_amps = scale_analog_value(raw_current_adc, 0, 4095, 0.0, 50.0);

    // State machine using switch
    switch (motor->mode) {
        case 0: // IDLE
            motor->running = 0;
            motor->fault_code = 0;
            if (start_command == 1) {
                motor->mode = 1; // Go to RUN
            }
            break;

        case 1: // RUNNING
            motor->running = 1;
            total_runtime_seconds++; // Accumulate runtime

            // Check for overcurrent fault
            if (motor->current_amps > 15.0) {
                motor->fault_code = 101; // Overcurrent
                motor->mode = 2; // Go to FAULT
            }
            // Check for overtemp fault
            else if (motor->temperature > 85.0) {
                motor->fault_code = 102; // Overtemp
                motor->mode = 2; // Go to FAULT
            }
            // Check stop command
            else if (stop_command == 1) {
                motor->mode = 0; // Go to IDLE
            }
            break;

        case 2: // FAULT
            motor->running = 0;
            // Stay in fault until reset - maintenance mode clears it
            break;

        case 3: // MAINTENANCE
            motor->running = 0;
            motor->fault_code = 0; // Clear faults in maintenance
            break;

        default: // Unknown state - safety
            motor->mode = 2; // Force to fault
            motor->running = 0;
            motor->fault_code = 999; // Invalid state
            break;
    }
}

// Example usage
int main() {
    MotorStatus motor1 = {0}; // Init all to zero
    float temp_readings[10] = {72.1, 73.5, 74.0, 75.2, 76.1, 77.0, 77.5, 78.0, 78.2, 78.5};
    float avg_temp;

    avg_temp = average_temperatures(temp_readings, 10);
    motor1.temperature = avg_temp;

    update_motor_control(&motor1, 1, 0, 2048); // Start command, mid-range current

    return 0;
}