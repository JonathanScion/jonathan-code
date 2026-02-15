import { Stepper, Step, StepLabel, Box } from '@mui/material';

interface StatusStepperProps {
  steps: string[];
  activeStep: string;
  isCancelled?: boolean;
}

export default function StatusStepper({ steps, activeStep, isCancelled }: StatusStepperProps) {
  const activeIndex = steps.indexOf(activeStep);

  if (isCancelled) {
    return (
      <Box sx={{ py: 1 }}>
        <Stepper activeStep={-1}>
          {steps.map((step) => (
            <Step key={step}>
              <StepLabel error>{step.replace(/_/g, ' ')}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <Stepper activeStep={activeIndex}>
        {steps.map((step) => (
          <Step key={step} completed={steps.indexOf(step) < activeIndex}>
            <StepLabel>{step.replace(/_/g, ' ')}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
