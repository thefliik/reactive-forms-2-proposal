import {
  Input,
  OnDestroy,
  OnChanges,
  Directive,
  ElementRef,
  Inject,
  Self,
  SimpleChange,
  SimpleChanges,
  forwardRef,
  Renderer2,
} from '@angular/core';
import {
  FormControl,
  ControlAccessor,
  NG_CONTROL_DIRECTIVE,
  ɵNgControlDirective,
} from 'reactive-forms-module2-proposal';

import {
  FormControlDirective,
  NgControl,
  ControlValueAccessor,
} from '@angular/forms';

import { NgCompatFormControl } from './ng_compat_form_control';

@Directive({
  selector: '[ngFormControl][formControl]',
  exportAs: 'ngCompatForm',
  providers: [
    {
      provide: NG_CONTROL_DIRECTIVE,
      useExisting: forwardRef(() => NgCompatFormControlDirective),
    },
  ],
})
export class NgCompatFormControlDirective
  extends ɵNgControlDirective<FormControl>
  implements ControlAccessor, OnChanges, OnDestroy {
  static id = 0;
  @Input('ngFormControl') providedControl!: FormControl;

  protected ngControl = new NgCompatFormControl(
    new FormControl(undefined, {
      id: Symbol(
        `NgCompatFormControlDirective-${NgCompatFormControlDirective.id++}`,
      ),
    }),
  );

  control = this.ngControl.swControl;

  protected valueAccessor: ControlValueAccessor | null;

  constructor(
    @Self()
    @Inject(NgControl)
    protected ngDirective: FormControlDirective,
    renderer: Renderer2,
    el: ElementRef,
  ) {
    super(renderer, el);

    const self = this;

    const orig = this.ngDirective.ngOnChanges.bind(this.ngDirective);

    let index = 0;

    this.ngDirective.ngOnChanges = (changes: SimpleChanges) => {
      const old = self.ngDirective.form;
      self.ngDirective.form = self.ngControl;
      orig({
        ...changes,
        form: new SimpleChange(old, self.ngControl, index === 0),
      });
      index++;
    };

    this.valueAccessor = this.ngDirective.valueAccessor;
  }

  ngOnChanges(changes: { providedControl?: SimpleChange }) {
    if (!this.providedControl) {
      throw new Error(
        `NgCompatFormControlDirective must be passed a FormControl`,
      );
    }

    if (!this.valueAccessor) {
      throw new Error(
        `NgCompatFormControlDirective could not find valueAccessor`,
      );
    }

    super.ngOnChanges(changes);
  }
}
