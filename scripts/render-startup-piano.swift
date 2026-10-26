import AVFoundation
import AudioToolbox

// Original, quiet Cmaj9–Fmaj9–Gsus2–Cmaj9 welcome phrase.
// Render with the system's acoustic-grand instrument; no sample bank is bundled.
let output = URL(fileURLWithPath: CommandLine.arguments[1])
let engine = AVAudioEngine()
let piano = AVAudioUnitSampler()
let room = AVAudioUnitReverb()
engine.attach(piano)
engine.attach(room)
let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
engine.connect(piano, to: room, format: format)
engine.connect(room, to: engine.mainMixerNode, format: format)
room.loadFactoryPreset(.mediumHall)
room.wetDryMix = 17
try piano.loadSoundBankInstrument(at: URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls"), program: 0, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
try engine.start()
var file: AVAudioFile? = try AVAudioFile(forWriting: output, settings: format.settings)
let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: engine.manualRenderingMaximumFrameCount)!
struct Event { let time: Double; let note: UInt8; let velocity: UInt8 }
let notes: [(Double, UInt8, UInt8)] = [
  (0.08, 48, 39), (0.24, 55, 42), (0.55, 64, 49), (0.90, 67, 51), (1.26, 71, 45), (1.64, 74, 44),
  (2.42, 53, 38), (2.60, 60, 42), (2.91, 64, 47), (3.25, 69, 49), (3.59, 72, 44),
  (4.48, 55, 38), (4.66, 62, 42), (4.98, 69, 46), (5.33, 74, 45),
  (6.08, 48, 36), (6.26, 55, 40), (6.48, 64, 44), (6.72, 67, 43), (7.00, 71, 38), (7.28, 76, 36)
]
var events = notes.map { Event(time: $0.0, note: $0.1, velocity: $0.2) }
events += notes.map { Event(time: $0.0 + 1.6, note: $0.1, velocity: 0) }
events.sort { $0.time < $1.time }
var index = 0
let total = AVAudioFramePosition(10.5 * format.sampleRate)
while engine.manualRenderingSampleTime < total {
  let current = engine.manualRenderingSampleTime
  while index < events.count && AVAudioFramePosition(events[index].time * format.sampleRate) <= current {
    let event = events[index]
    if event.velocity == 0 { piano.stopNote(event.note, onChannel: 0) }
    else { piano.startNote(event.note, withVelocity: event.velocity, onChannel: 0) }
    index += 1
  }
  let next = index < events.count ? AVAudioFramePosition(events[index].time * format.sampleRate) : total
  let count = AVAudioFrameCount(min(4096, min(total - current, max(1, next - current))))
  let status = try engine.renderOffline(count, to: buffer)
  if status == .success { try file!.write(from: buffer) }
  else if status == .error { fatalError("Piano rendering failed") }
}
engine.stop()
file = nil // Finalize the WAV header before the command exits.
print("Rendered original piano phrase: 10.5 seconds, 44.1 kHz, stereo")
