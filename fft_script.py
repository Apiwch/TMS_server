import numpy as np
import json

def calculate_fft(data):
    # Assuming data is a list of numbers
    fft_result = np.fft.fft(data)
    frequencies = np.fft.fftfreq(len(data))
    sampling_rate = 1500  
    frequencies_hz = frequencies * sampling_rate
    f = frequencies_hz[:len(frequencies)//2].tolist()
    a = np.abs(fft_result)[:len(frequencies)//2].tolist()
    
    # Create a list of dictionaries
    result = []
    for freq, amp in zip(f, a):
        result.append({"frequency": round(freq, 2), "amplitude": round(amp, 2)})
        
    return result

if __name__ == "__main__":
    input_data = json.loads(input())
    fft_result = calculate_fft(input_data)
    print(json.dumps(fft_result))
