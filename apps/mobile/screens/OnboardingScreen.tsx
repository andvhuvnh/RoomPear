/**
 * Onboarding screen with step-by-step modal popups
 * Each preference is collected one at a time in a seamless flow
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { savePreferences, Preferences } from '../lib/preferences';

interface OnboardingScreenProps {
  onComplete: () => void;
}

type OnboardingStep =
  | 'about-you'
  | 'location'
  | 'budget'
  | 'room-type'
  | 'move-in-date'
  | 'lifestyle'
  | 'must-haves'
  | 'complete';

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('about-you');
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Partial<Preferences>>({});

  // Profile state (age, gender, ethnicity)
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string>('');
  const [ethnicity, setEthnicity] = useState<string>('');

  // Form state
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [roomType, setRoomType] = useState<'private' | 'shared' | 'either Private or Shared' | ''>('');
  const [moveInDate, setMoveInDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState<boolean | null>(null);
  const [smokingAllowed, setSmokingAllowed] = useState<boolean | null>(null);
  const [cleanlinessLevel, setCleanlinessLevel] = useState<number | null>(null);
  const [socialPreference, setSocialPreference] = useState<'social' | 'quiet' | 'balanced' | ''>('');

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  const ensureProfileExists = async () => {
    if (!userId) return false;

    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      // If profile doesn't exist, create it
      if (!existingProfile) {
        // Get user email from auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email || '',
            name: user.user_metadata?.name || user.email || 'User',
            phone: user.user_metadata?.phone || '000-000-0000',
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error ensuring profile exists:', error);
      return false;
    }
  };

  const saveProfileInfo = async () => {
    if (!userId) return;

    try {
      // Ensure profile exists first
      const profileExists = await ensureProfileExists();
      if (!profileExists) {
        console.error('Failed to ensure profile exists');
        return;
      }

      const updates: any = {};
      if (age) updates.age = parseInt(age);
      if (gender) updates.gender = gender;
      if (ethnicity) updates.ethnicity = ethnicity;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId);

        if (error) {
          console.error('Error updating profile:', error);
        }
      }
    } catch (error) {
      console.error('Error saving profile info:', error);
    }
  };

  const handleNext = async () => {
    // Save current step data
    switch (currentStep) {
      case 'about-you':
        await saveProfileInfo();
        setCurrentStep('location');
        break;
      case 'location':
        setPreferences({
          ...preferences,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip_code: zipCode.trim() || undefined,
        });
        setBudgetError(''); // Clear any previous budget error
        setCurrentStep('budget');
        break;
      case 'budget':
        // Validate budget before proceeding
        if (minBudget && maxBudget && parseFloat(minBudget) > parseFloat(maxBudget)) {
          Alert.alert('Invalid Budget', 'Min budget cannot be higher than max budget');
          return;
        }
        setPreferences({
          ...preferences,
          min_budget: minBudget ? parseFloat(minBudget) : undefined,
          max_budget: maxBudget ? parseFloat(maxBudget) : undefined,
        });
        setCurrentStep('room-type');
        break;
      case 'room-type':
        setPreferences({
          ...preferences,
          room_type: roomType || undefined,
        });
        setCurrentStep('move-in-date');
        break;
      case 'move-in-date':
        setPreferences({
          ...preferences,
          move_in_date: moveInDate ? moveInDate.toISOString().split('T')[0] : undefined,
        });
        setCurrentStep('lifestyle');
        break;
      case 'lifestyle':
        setPreferences({
          ...preferences,
          pets_allowed: petsAllowed ?? undefined,
          smoking_allowed: smokingAllowed ?? undefined,
          cleanliness_level: cleanlinessLevel ?? undefined,
          social_preference: socialPreference || undefined,
        });
        setCurrentStep('must-haves');
        break;
      case 'must-haves':
        // Skip must-haves for now (can add later)
        handleComplete();
        break;
    }
  };

  const handlePrevious = () => {
    // Clear budget error when leaving budget step
    if (currentStep === 'budget') {
      setBudgetError('');
    }
    // Navigate to previous step
    switch (currentStep) {
      case 'location':
        setCurrentStep('about-you');
        break;
      case 'budget':
        setCurrentStep('location');
        break;
      case 'room-type':
        setCurrentStep('budget');
        break;
      case 'move-in-date':
        setCurrentStep('room-type');
        break;
      case 'lifestyle':
        setCurrentStep('move-in-date');
        break;
      case 'must-haves':
        setCurrentStep('lifestyle');
        break;
      default:
        break;
    }
  };

  const handleSkip = () => {
    // Allow skipping optional steps
    if (currentStep === 'about-you') {
      setCurrentStep('location');
    } else if (currentStep === 'location') {
      setCurrentStep('budget');
    } else if (currentStep === 'budget') {
      setCurrentStep('room-type');
    } else if (currentStep === 'room-type') {
      setCurrentStep('move-in-date');
    } else if (currentStep === 'move-in-date') {
      setCurrentStep('lifestyle');
    } else if (currentStep === 'lifestyle') {
      setCurrentStep('must-haves');
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);
    try {
      // Ensure profile exists before saving preferences
      const profileExists = await ensureProfileExists();
      if (!profileExists) {
        Alert.alert('Error', 'Failed to create user profile. Please try again.');
        setLoading(false);
        return;
      }

      const result = await savePreferences(userId, preferences);
      if (result.success) {
        onComplete();
      } else {
        Alert.alert('Error', result.error || 'Failed to save preferences');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'about-you':
        return 'Tell us about yourself';
      case 'location':
        return 'Where are you looking?';
      case 'budget':
        return 'What\'s your budget?';
      case 'room-type':
        return 'What type of room?';
      case 'move-in-date':
        return 'When do you want to move in?';
      case 'lifestyle':
        return 'Tell us about your lifestyle';
      case 'must-haves':
        return 'Any must-haves?';
      default:
        return 'Welcome!';
    }
  };

  const getStepNumber = () => {
    const steps: OnboardingStep[] = ['about-you', 'location', 'budget', 'room-type', 'move-in-date', 'lifestyle', 'must-haves'];
    return steps.indexOf(currentStep) + 1;
  };

  const getTotalSteps = () => 7;

  const renderStepContent = () => {
    switch (currentStep) {
      case 'about-you':
        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepDescription}>
              Help us get to know you better
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Age"
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
            />
            <Text style={styles.questionLabel}>Gender</Text>
            {['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  gender === option && styles.optionButtonSelected,
                ]}
                onPress={() => setGender(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    gender === option && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.questionLabel}>Ethnicity (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ethnicity"
              value={ethnicity}
              onChangeText={setEthnicity}
            />
            <Text style={styles.hint}>
              This helps us create better matches
            </Text>
          </ScrollView>
        );

      case 'location':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              Help us find the perfect place for you
            </Text>
            <TextInput
              style={styles.input}
              placeholder="City"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={styles.input}
              placeholder="State"
              value={state}
              onChangeText={setState}
            />
            <TextInput
              style={styles.input}
              placeholder="ZIP Code (optional)"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
            />
          </View>
        );

      case 'budget':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              What's your monthly rent budget?
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Min budget ($)"
              value={minBudget}
              onChangeText={(text) => {
                setMinBudget(text);
                if (text && maxBudget && parseFloat(text) > parseFloat(maxBudget)) {
                  setBudgetError('Min budget cannot be higher than max budget');
                } else {
                  setBudgetError('');
                }
              }}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Max budget ($)"
              value={maxBudget}
              onChangeText={(text) => {
                setMaxBudget(text);
                if (text && minBudget && parseFloat(minBudget) > parseFloat(text)) {
                  setBudgetError('Min budget cannot be higher than max budget');
                } else {
                  setBudgetError('');
                }
              }}
              keyboardType="numeric"
            />
            {budgetError ? (
              <Text style={styles.errorText}>{budgetError}</Text>
            ) : null}
          </View>
        );

      case 'room-type':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              What type of room are you looking for?
            </Text>
            {['private', 'shared', 'either Private or Shared'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  roomType === type && styles.optionButtonSelected,
                ]}
                onPress={() => setRoomType(type as any)}
              >
                <Text
                  style={[
                    styles.optionText,
                    roomType === type && styles.optionTextSelected,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} Room
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'move-in-date':
        const formatDate = (date: Date | null): string => {
          if (!date) return '';
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Get tomorrow's date (minimum selectable date)
        const getTomorrow = () => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0); // Set to start of day
          return tomorrow;
        };

        const displayDate = moveInDate ? formatDate(moveInDate) : '';
        const tomorrow = getTomorrow();

        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              When would you like to move in?
            </Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.datePickerText, !moveInDate && styles.datePickerPlaceholder]}>
                {displayDate || 'Select a date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={moveInDate || tomorrow}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      // Ensure selected date is after today
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selected = new Date(selectedDate);
                      selected.setHours(0, 0, 0, 0);
                      if (selected > today) {
                        setMoveInDate(selectedDate);
                      }
                    }
                  } else {
                    // iOS - keep picker open, user will tap Done
                    if (selectedDate) {
                      // Ensure selected date is after today
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selected = new Date(selectedDate);
                      selected.setHours(0, 0, 0, 0);
                      if (selected > today) {
                        setMoveInDate(selectedDate);
                      }
                    }
                  }
                }}
                minimumDate={tomorrow}
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <View style={styles.iosDatePickerActions}>
                <TouchableOpacity
                  style={styles.datePickerActionButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerActionText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.hint}>
              You can update this later
            </Text>
          </View>
        );

      case 'lifestyle':
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              A few questions about your lifestyle
            </Text>

            <Text style={styles.questionLabel}>Do you have pets or allow pets?</Text>
            <View style={styles.booleanOptions}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  petsAllowed === true && styles.optionButtonSelected,
                ]}
                onPress={() => setPetsAllowed(true)}
              >
                <Text
                  style={[
                    styles.optionText,
                    petsAllowed === true && styles.optionTextSelected,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  petsAllowed === false && styles.optionButtonSelected,
                ]}
                onPress={() => setPetsAllowed(false)}
              >
                <Text
                  style={[
                    styles.optionText,
                    petsAllowed === false && styles.optionTextSelected,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.questionLabel}>Do you smoke or allow smoking?</Text>
            <View style={styles.booleanOptions}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  smokingAllowed === true && styles.optionButtonSelected,
                ]}
                onPress={() => setSmokingAllowed(true)}
              >
                <Text
                  style={[
                    styles.optionText,
                    smokingAllowed === true && styles.optionTextSelected,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  smokingAllowed === false && styles.optionButtonSelected,
                ]}
                onPress={() => setSmokingAllowed(false)}
              >
                <Text
                  style={[
                    styles.optionText,
                    smokingAllowed === false && styles.optionTextSelected,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.questionLabel}>Cleanliness level (1-5)</Text>
            <View style={styles.cleanlinessOptions}>
              {[1, 2, 3, 4, 5].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.cleanlinessButton,
                    cleanlinessLevel === level && styles.optionButtonSelected,
                  ]}
                  onPress={() => setCleanlinessLevel(level)}
                >
                  <Text
                    style={[
                      styles.cleanlinessText,
                      cleanlinessLevel === level && styles.optionTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.questionLabel}>Social preference</Text>
            {['social', 'quiet', 'balanced'].map((pref) => (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.optionButton,
                  socialPreference === pref && styles.optionButtonSelected,
                ]}
                onPress={() => setSocialPreference(pref as any)}
              >
                <Text
                  style={[
                    styles.optionText,
                    socialPreference === pref && styles.optionTextSelected,
                  ]}
                >
                  {pref.charAt(0).toUpperCase() + pref.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );

      case 'must-haves':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              Any must-have features?
            </Text>
            <Text style={styles.hint}>
              (This can be added later - you can skip for now)
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Modal
        visible={true}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(getStepNumber() / getTotalSteps()) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Step {getStepNumber()} of {getTotalSteps()}
              </Text>
            </View>

            {/* Step title */}
            <Text style={styles.stepTitle}>{getStepTitle()}</Text>

            {/* Step content */}
            {renderStepContent()}

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              {currentStep !== 'about-you' && (
                <TouchableOpacity
                  style={[styles.button, styles.previousButton]}
                  onPress={handlePrevious}
                  disabled={loading}
                >
                  <Text style={styles.previousButtonText}>Previous</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.skipButton]}
                onPress={handleSkip}
                disabled={loading}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.nextButton]}
                onPress={handleNext}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.nextButtonText}>
                    {currentStep === 'must-haves' ? 'Complete' : 'Next'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D9E1E6', // Light Cool Gray
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 83, 137, 0.5)', // Deep Blue with transparency
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#0C5389', // Deep Blue
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#D9E1E6', // Light Cool Gray
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#189AA2', // Teal / Blue-Green
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#0C5389', // Deep Blue
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0C5389', // Deep Blue
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#0C5389', // Deep Blue
    marginBottom: 20,
    textAlign: 'center',
  },
  stepContent: {
    minHeight: 200,
    maxHeight: 400,
  },
  input: {
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D9E1E6', // Light Cool Gray
    color: '#0C5389', // Deep Blue
  },
  optionButton: {
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#D9E1E6', // Light Cool Gray
  },
  optionButtonSelected: {
    backgroundColor: '#189AA2', // Teal / Blue-Green
    borderColor: '#189AA2', // Teal / Blue-Green
  },
  optionText: {
    fontSize: 16,
    color: '#0C5389', // Deep Blue
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#FDFDFD', // Pure White
    fontWeight: '600',
  },
  booleanOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  cleanlinessOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    justifyContent: 'center',
  },
  cleanlinessButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FDFDFD', // Pure White
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D9E1E6', // Light Cool Gray
  },
  cleanlinessText: {
    fontSize: 18,
    color: '#0C5389', // Deep Blue
    fontWeight: '600',
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389', // Deep Blue
    marginTop: 20,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: '#189AA2', // Teal / Blue-Green
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B', // Red for errors
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  datePickerButton: {
    backgroundColor: '#FDFDFD', // Pure White
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#D9E1E6', // Light Cool Gray
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#0C5389', // Deep Blue
  },
  datePickerPlaceholder: {
    color: '#999', // Gray for placeholder
  },
  iosDatePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    marginBottom: 15,
  },
  datePickerActionButton: {
    padding: 10,
    paddingHorizontal: 20,
    backgroundColor: '#46BD7F', // Primary Green
    borderRadius: 8,
  },
  datePickerActionText: {
    color: '#FDFDFD', // Pure White
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  previousButton: {
    backgroundColor: '#D9E1E6', // Light Cool Gray
  },
  previousButtonText: {
    color: '#0C5389', // Deep Blue
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: '#D9E1E6', // Light Cool Gray
  },
  skipButtonText: {
    color: '#0C5389', // Deep Blue
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#46BD7F', // Primary Green
  },
  nextButtonText: {
    color: '#FDFDFD', // Pure White
    fontSize: 16,
    fontWeight: '600',
  },
});
