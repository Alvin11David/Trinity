import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const STEPS = ['Account', 'Profile', 'Done'];

function StepIndicator({ current, c }: { current: number; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 }}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: i <= current ? c.primary : c.gray200,
          }}>
            {i < current ? (
              <Ionicons name="checkmark" size={13} color="#fff" />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: '700', color: i === current ? '#fff' : c.muted }}>{i + 1}</Text>
            )}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: i === current ? c.primary : c.muted }}>{s}</Text>
          {i < STEPS.length - 1 && <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />}
        </View>
      ))}
    </View>
  );
}

export default function RegisterScreen() {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', bio: '', favorite_club: '' });
  const register = useAuthStore((state) => state.register);
  const c = useThemeColors();
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const inputStyle = {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500' as const,
    color: c.text,
  };

  const handleNext = async () => {
    setError('');
    if (step === 0) {
      if (!form.username || !form.email || !form.password) { setError('Please fill in all fields.'); return; }
      setStep(1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await register(form.username, form.email, form.password);
      router.replace('/(main)/(app)/(tabs)' as Href);
    } catch {
      setError('Could not create account. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>B</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>Ball</Text>
          </View>

          <Text style={{ fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 4 }}>Create your account</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginBottom: 24 }}>Join the football community.</Text>

          <StepIndicator current={step} c={c} />

          {/* Error */}
          {error ? (
            <View style={{ backgroundColor: c.isDark ? '#450a0a' : '#fef2f2', borderWidth: 1, borderColor: c.isDark ? '#b91c1c' : '#fecaca', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24 }}>
              <Text style={{ color: c.isDark ? '#f87171' : '#b91c1c', fontSize: 14, fontWeight: '500' }}>{error}</Text>
            </View>
          ) : null}

          {/* Step 0 */}
          {step === 0 && (
            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 6 }}>First Name</Text>
                  <TextInput style={inputStyle} placeholder="Kwame" placeholderTextColor={c.muted} value={form.first_name} onChangeText={set('first_name')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 6 }}>Last Name</Text>
                  <TextInput style={inputStyle} placeholder="Asante" placeholderTextColor={c.muted} value={form.last_name} onChangeText={set('last_name')} />
                </View>
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 6 }}>Username</Text>
                <TextInput style={inputStyle} placeholder="kwame_fc" placeholderTextColor={c.muted} value={form.username} onChangeText={set('username')} autoCapitalize="none" autoCorrect={false} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 6 }}>Email</Text>
                <TextInput style={inputStyle} placeholder="kwame@example.com" placeholderTextColor={c.muted} value={form.email} onChangeText={set('email')} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 6 }}>Password</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: passwordFocused ? c.primary : c.border, borderRadius: 8, paddingHorizontal: 14 }}>
                  <TextInput style={{ flex: 1, fontSize: 14, fontWeight: '500', color: c.text, paddingVertical: 10, outlineStyle: 'none' }} placeholder="••••••••" placeholderTextColor={c.muted} value={form.password} onChangeText={set('password')} secureTextEntry={!showPassword} autoCorrect={false} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={17} color={c.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: c.text, marginBottom: 6 }}>Favourite Club <Text style={{ fontWeight: '400', color: c.muted }}>(optional)</Text></Text>
                <TextInput style={inputStyle} placeholder="e.g. Arsenal" placeholderTextColor={c.muted} value={form.favorite_club} onChangeText={set('favorite_club')} />
              </View>
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="checkmark-circle" size={64} color={c.primary} />
              <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginTop: 16 }}>Welcome to Ball!</Text>
              <Text style={{ fontSize: 14, color: c.muted, marginTop: 8 }}>Your account has been created.</Text>
            </View>
          )}

          {/* Button */}
          <TouchableOpacity
            style={{ backgroundColor: loading ? c.primary + '99' : c.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 24, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            onPress={handleNext} disabled={loading} activeOpacity={0.8}
          >
            {loading && <ActivityIndicator color="#fff" size={17} />}
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
              {step < 1 ? 'Continue' : loading ? 'Creating account…' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {step > 0 && step < 2 && (
            <TouchableOpacity onPress={() => { setStep((s) => s - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, color: c.muted, fontWeight: '500' }}>← Back</Text>
            </TouchableOpacity>
          )}

          {step === 0 && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(auth)/login'); }} activeOpacity={0.7} style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>
                Already have an account? <Text style={{ color: c.primary, fontWeight: '500' }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
