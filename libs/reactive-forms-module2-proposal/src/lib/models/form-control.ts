import { ControlBase, IControlBaseArgs } from './control-base';

export type IFormControlArgs<D> = IControlBaseArgs<D>;

export class FormControl<V = any, D = any> extends ControlBase<V, D> {
  static id = 0;

  constructor(value?: V, options: IFormControlArgs<D> = {}) {
    super(
      options.id || Symbol(`FormControl-${FormControl.id++}`),
      value,
      options,
    );
  }
}
