/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ready-to-use SDK Integration Snippets for Web, React Native, and Flutter.
 */

export const CODE_SNIPPETS = {
  javascript: {
    title: 'Web & JavaScript / TypeScript SDK',
    language: 'typescript',
    filename: 'hmong-tts-web.ts',
    code: `import { HmongTTSClient } from '@hmong-tts/core';

// Initialize the Hmong TTS client (with Auto-Detect)
const tts = new HmongTTSClient({
  dialect: 'dawb', // 'dawb' (White Hmong) or 'leeg' (Green/Mong Leng)
  voice: 'paj_dawb_female',
  offlineOnly: true, // Guarantees zero network latency (<15ms)
  autoDetect: true,  // Automatically identifies Hmong vs English & routes to appropriate engine!
  rate: 1.0,
  pitch: 1.0,
});

// 1. Language Auto-Detection
const detection = tts.detect("Welcome to Hmong speech!");
console.log(detection.language); // 'english' (routes to Web Speech API)

// 2. Multilingual Speech with word highlighting
await tts.speak("Nyob zoo sawv daws! Welcome to our app.", {
  onWord: (index, token) => {
    console.log(\`Speaking word \${index}: \${token.clean}\`);
  },
  onEnd: () => {
    console.log("Speech finished!");
  }
});

// 2. Export offline lossless WAV audio blob
const wavBlob = await tts.synthesizeToWav("Ua tsaug ntau ntau!");
const audioUrl = URL.createObjectURL(wavBlob);
const audio = new Audio(audioUrl);
audio.play();`,
  },

  reactNative: {
    title: 'React Native (iOS & Android)',
    language: 'tsx',
    filename: 'HmongSpeechScreen.tsx',
    code: `import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { HmongPhonology, parseHmongText } from '@hmong-tts/core';

/**
 * Mobile Hmong TTS Component for React Native / Expo.
 * Supports offline acoustic playback and background audio.
 */
export function HmongSpeechScreen() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const textToSpeak = "Nyob zoo sawv daws! Txais tos tuaj koom peb.";

  async function handleSpeak() {
    try {
      setIsPlaying(true);

      // Call Hmong TTS engine endpoint or local native bridge
      const response = await fetch('https://api.hmongtts.org/v1/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          dialect: 'dawb', // or 'leeg' for Moob Leeg
          voiceId: 'paj_dawb_female',
          format: 'wav',
        }),
      });

      const { audioBase64, alignment } = await response.json();
      const soundUri = \`data:audio/wav;base64,\${audioBase64}\`;

      // Play through React Native Audio engine
      const { sound: playbackObj } = await Audio.Sound.createAsync(
        { uri: soundUri },
        { shouldPlay: true }
      );
      setSound(playbackObj);

      playbackObj.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          setActiveWordIndex(-1);
        }
      });
    } catch (err) {
      console.error('Failed to play Hmong audio:', err);
      setIsPlaying(false);
    }
  }

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Hmong TTS Mobile Assistant</Text>
      <Text style={styles.bodyText}>{textToSpeak}</Text>

      <TouchableOpacity
        style={[styles.button, isPlaying && styles.buttonActive]}
        onPress={handleSpeak}
        disabled={isPlaying}
      >
        <Text style={styles.buttonText}>{isPlaying ? 'Hais lus... (Speaking)' : 'Hais Lus (Speak Hmong)'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0f172a' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc', marginBottom: 12 },
  bodyText: { fontSize: 18, color: '#94a3b8', lineHeight: 28, marginBottom: 24 },
  button: { backgroundColor: '#0d9488', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonActive: { backgroundColor: '#0f766e' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});`,
  },

  flutter: {
    title: 'Flutter (Dart Android, iOS & Web)',
    language: 'dart',
    filename: 'hmong_tts_service.dart',
    code: `import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:audioplayers/audioplayers.dart';

enum HmongDialect { dawb, leeg }

class HmongTTSService {
  static const String _apiEndpoint = 'https://api.hmongtts.org/v1/synthesize';
  final AudioPlayer _player = AudioPlayer();

  /// Synthesizes Hmong text to low-latency audio in White or Green dialect.
  Future<void> speakHmong({
    required String text,
    HmongDialect dialect = HmongDialect.dawb,
    String voiceId = 'paj_dawb_female',
    double rate = 1.0,
    Function(int)? onWordChanged,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(_apiEndpoint),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'text': text,
          'dialect': dialect == HmongDialect.dawb ? 'dawb' : 'leeg',
          'voiceId': voiceId,
          'rate': rate,
          'format': 'wav',
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final String base64Audio = data['audioBase64'];
        final bytes = base64Decode(base64Audio);

        // Play in-memory bytes on mobile device
        await _player.play(BytesSource(bytes));
      } else {
        throw Exception('TTS API Error: \${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error speaking Hmong: \$e');
      rethrow;
    }
  }

  void stop() => _player.stop();
  void dispose() => _player.dispose();
}

/// Example Flutter Widget using HmongTTSService
class HmongSpeakButton extends StatefulWidget {
  final String hmongSentence;
  const HmongSpeakButton({Key? key, required this.hmongSentence}) : super(key: key);

  @override
  State<HmongSpeakButton> createState() => _HmongSpeakButtonState();
}

class _HmongSpeakButtonState extends State<HmongSpeakButton> {
  final HmongTTSService _tts = HmongTTSService();
  bool _speaking = false;

  @override
  void dispose() {
    _tts.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF0D9488),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      icon: Icon(_speaking ? Icons.volume_up : Icons.play_arrow),
      label: Text(_speaking ? 'Speaking...' : 'Speak Hmong'),
      onPressed: _speaking ? null : () async {
        setState(() => _speaking = true);
        await _tts.speakHmong(text: widget.hmongSentence);
        setState(() => _speaking = false);
      },
    );
  }
}`,
  },

  restApi: {
    title: 'REST API & cURL',
    language: 'bash',
    filename: 'curl-example.sh',
    code: `# 1. Synthesize Hmong text to audio
curl -X POST "https://your-domain.com/api/tts/synthesize" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Nyob zoo! Hmoob lub suab hais lus zoo heev.",
    "dialect": "dawb",
    "voiceId": "paj_dawb_female",
    "rate": 1.0,
    "pitch": 1.0,
    "format": "wav"
  }'

# 2. Auto-Detect Language (Hmong vs English vs Mixed)
curl -X POST "https://your-domain.com/api/tts/detect" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Nyob zoo sawv daws! Welcome everyone."
  }'

# 3. Phonemize & Analyze Hmong Syllable Tones
curl -X POST "https://your-domain.com/api/tts/phonemize" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Koj tuaj qhov twg tuaj?",
    "dialect": "dawb"
  }'

# 4. Retrieve available dialect voices
curl -X GET "https://your-domain.com/api/voices"`,
  },
};
