# This is a proposal to improve `@angular/forms`

For an overview of this proposal, and to provide most feedback, head over to the associated angular issue: https://github.com/angular/angular/issues/31963.

You can demo this proposal on stackblitz: https://stackblitz.com/github/thefliik/reactive-forms-2-proposal.

The focus of this repo is on the API design, **_not_** this specific implementation. For example, this implementation has a dependency on lodash, a version included in Angular/forms would not want this dependency.

If you like this proposal, and wish to update it, feel free to make PRs against this repo. Most discussion of the merits of this proposal would be better left in the associated angular issue.

This proposal is published on npm as `reactive-forms-module2-proposal`. This is an experimental module that is _not suitable for production_.

## ControlEvent API

At the core of this AbstractControl proposal is a new ControlEvent API which controls all mutations (state changes) to the AbstractControl. It is powered by two properties on the AbstractControl: `source: ControlSource<PartialControlEvent>` and `events: Observable<ControlEvent>` (where `ControlSource` is simply a modified rxjs `Subject`).

> _Note: only *advanced users* of the AbstractControl API need to know about the ControlEvent API. Most users can simply use the methods provided on AbstractControl to accomplish everything (and don't even need to know that the ControlEvent API is being used internally to accomplish tasks)._

To change the state of an AbstractControl, you emit a new PartialControlEvent object from the `source` property. This object has the interface

_Figure 1:_

```ts
interface PartialControlEvent {
  id?: string;
  source: ControlId;
  readonly processed: ControlId[];
  type: string;
  meta?: { [key: string]: any };
  noEmit?: boolean;
}

type ControlId = string | symbol;
```

When you call a method like `AbstractControl#markTouched()`, that method simply constructs the appropriate ControlEvent object for you and emits that object from `source`.

_Figure 2:_

```ts
class FormControl<Value = any, Data = any> implements AbstractControl<Value, Data> {
  id: ControlId;

  markTouched(value: boolean, options: ControlEventOptions = {}) {
    if (value !== this._touched) {
      this.source.next({
        source: options.source || this.id,
        processed: [],
        type: 'StateChange',
        changes: new Map([['touched', value]])
        noEmit: options.noEmit,
        meta: options.meta,
      });
    }
  }
}
```

Internally, the AbstractControl subscribes to output from the `source` property and pipes that output to a `protected processEvent()` method. After being processed, a new `ControlEvent` object containing any changes is emitted from the control's `events` property (so when a subscriber receives a ControlEvent from the `events` property, any changes have already been applied to the AbstractControl).

_Figure 3:_

```ts
class FormControl<Value = any, Data = any>
  implements AbstractControl<Value, Data> {
  id: ControlId;

  constructor() {
    this.source
      .pipe(
        filter(
          // make sure we don't process an event we already processed
          event => !event.processed.includes(this.id),
        ),
      )
      .subscribe(event => {
        event.processed.push(this.id);
        if (!event.meta) event.meta = {};
        if (!event.id) event.id = AbstractControl.eventId();

        const newEvent = this.processEvent(event as ControlEvent);

        if (newEvent) {
          this._events.next(newEvent);
        }
      });
  }
}
```

You'll notice that only events that haven't yet been processed by this `AbstractControl` are processed (i.e. `!event.processed.includes(this.id)`). This allows two AbstractControls to subscribe to each other's events without entering into an infinite loop.

### Extensibility

This ControlEvent API is highly extensible. At any time, a user can emit a custom event using the `AbstractControl#emitEvent()` method. A custom event will have no meaning to the AbstractControl itself, but it will be emitted from the `events` observable and the user can act on the event as appropriate. Similarly, if you actually create a custom AbstractControl (or extend an existing AbstractControl), you can simply define new events and add in custom logic to process them.

While many of the built-in ControlEvents which are emitted are `StateChange` events, not all of them are. For example, the current `FormControlDirective` emits a custom `{type: "ControlAccessor", label: 'PreInit" | "PostInit" | "Cleanup"}` event to allow hooking into the `FormControlDirective's` lifecycle. Similarly, `Validation` lifecycle events are emitted to allow hooking into a control's validation process. The validation lifecycle is useful if you want a custom validation service to monitor a control.

### View the API of individual ControlEvents

At the moment, the place to view all the different predefined control events is in the source code. The `protected processEvent()` method is responsible for processing all control events. Eventually, it would be important to document the interface of different control events.

- [view source code](./libs/reactive-forms-module2-proposal/src/lib/models/control-base.ts)

## ControlAccessor API

This proposal can easily be made compatible with the current `ControlValueAccessor` API. This being said, this proposal enables the following new, simpler and more powerful `ControlAccessor` interface:

```ts
interface ControlAccessor<T extends AbstractControl = AbstractControl> {
  readonly control: T;
}

interface ControlContainerAccessor<
  T extends ControlContainer = ControlContainer
> extends ControlAccessor<T> {}
```

This new `ControlAccessor` interface can be seen in action in this repo's `directives` folder (e.g. `NgFormControlDirective`). The new interface greatly simplifies the process of implementing a `ControlAccessor` -- all you need to do is add a `control` property containing an abstract control.

For example:

```ts
@Component({
  selector: 'app-example',
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss'],
  providers: [
    {
      provide: NG_CONTROL_ACCESSOR,
      useExisting: forwardRef(() => ExampleComponent),
      multi: true,
    },
  ],
})
export class ExampleComponent implements ControlAccessor {
  readonly control = new FormControl<Date | null>(null);
}
```

If you want to mark the control accessor as touched, simply `control.markTouched(true)`. If you want to update the value of the control, simply `control.patchValue(new Date())`. If you wish to subscribe to value changes of a `ControlAccessor`, simply grab the `control` property and subscribe to value changes `control.observeChanges('value')`. Because of the easy ability to sync controls with the new control events API, you can link your form control to a `ControlAccessor` via:

```ts
@Component({
  selector: 'app-example',
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.scss'],
})
export class ExampleComponent {
  readonly control = new FormControl('Angular');
  readonly accessor: ControlAccessor;

  private subscriptions: Subscription[] = [];

  constructor(
    @Self()
    @Inject(NG_CONTROL_ACCESSOR)
    accessors: ControlAccessor[],
  ) {
    this.accessor = resolveControlAccessor(accessors);
  }

  ngOnInit() {
    this.subscriptions.push(
      // here we set the accessor state to be identical to our
      // control's state
      this.control.replayState().subscribe(this.accessor.control.source),
      // then we subscribe the accessor to events in our control state
      this.control.events.subscribe(this.accessor.control.source),
      // we also subscribe our control to events in the accessor start
      this.accessor.control.events.subscribe(this.control.source),
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
```

This way, any changes to the `ExampleComponent's` control are reflected in the linked accessor, and any changes to the linked accessor's control are reflected in the `ExampleComponent's` control. Also note, the `ExampleComponent` is a valid ControlAccessor itself!.

### Creating a `ControlContainerAccessor`

The new `ControlAccessor` API also allows for ControlAccessors which contain a `ControlContainer` such as a `FormGroup` or `FormArray`. For example, you could choose to create a `<people-form-component>` component which implements `ControlContainerAccessor<FormArray>`:

```ts
@Component({
  selector: 'app-people-form',
  templateUrl: './people-form.component.html',
  styleUrls: ['./people-form.component.scss'],
})
export class PeopleFormComponent implements ControlContainerAccessor {
  readonly control = new FormArray<
    Array<
      FormGroup<{
        id: FormControl<String>;
        name: FormControl<string>;
      }>
    >
  >();

  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.subscriptions.push(
      this.control.events
        .pipe(
          // The FormControlDirective's API gives us a few lifecycle hooks.
          // Here, after this ControlAccessor has been linked to another control via a
          // FormControlDirective, we finish initialization by adding in two default
          // FormGroups
          filter(
            ({ type, value }) =>
              type === 'ControlAccessor' && value === 'PostInit',
          ),
        )
        .subscribe(() => {
          this.control.addControl(
            new FormGroup({
              id: new FormControl(1),
              name: new FormControl('Angular'),
            }),
          );
          this.control.addControl(
            new FormGroup({
              id: new FormControl(3),
              name: new FormControl('ReactiveForms'),
            }),
          );
        }),
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
```

## AbstractControl API

The ControlEvent API enables some cool features. A few of which I'll highlight here (also check out the examples demonstration on stackblitz):

### errors

While this API proposal doesn't focus on the ReactiveFormsModule's errors API, it does improve upon the current API by internally storing error objects keyed to a source.

For example:

```ts
const control = new FormControl();

control.setErrors({ required: true });

control.errors; // => { required: true }

control.setErrors({ name: 'invalid' }, { source: 'myService' });

control.errors; // => { required: true, name: 'invalid' }

control.setErrors(null);

control.errors; // => { name: 'invalid' }

control.setErrors(null, { source: 'myService' });

control.errors; // => null
```

This allows different sources to add errors to a control, without needing to worry about those errors being overwritten by another source. When viewing `AbstractControl#errors`, all the errors are merged together into a single object. The validators and pending APIs work similarly (also storing their values keyed to a source).

### pending

Similar to the errors API, calls to `AbstractControl#markPending()` are keyed to a source. `AbstractControl#pending` will be true so long as any source is pending.

For example:

```ts
const control = new FormControl();

control.markPending(true);

control.pending; // => true

control.markPending(true, { source: 'myService' });

control.pending; // => true

control.markPending(false);

control.pending; // => true

control.markPending(false, { source: 'myService' });

control.pending; // => false
```

### Async Validation

The control events API allows us to validate our controls using services! (also shown in Example Four of the stackblitz demo):

```ts
class ExampleFourComponent implements OnInit {
  usernameControl = new FormControl('');

  constructor(
    // using Inject here for stackblitz compatibility
    @Inject(UserService)
    private userService: UserService,
  ) {}

  ngOnInit() {
    this.usernameControl.events
      .pipe(
        // Wait for the control to complete its synchronous validation.
        filter(event => event.type === 'validation' && event.value === 'end'),
        tap(() => {
          // Discard any existing errors set by the userService as they are
          // no longer applicable.
          this.usernameControl.setErrors(null, {
            source: `userService`,
          });

          // If the control is already marked invalid, we're going to skip the async
          // validation check so don't bother to mark pending.
          this.usernameControl.markPending(this.usernameControl.valid, {
            source: `userService`,
          });
        }),
        // By running validation inside a `switchMap` + `interval()` (instead
        // of `debounceTime()`), we ensure that an in-progress async validation
        // check is discarded if the user starts typing again.
        switchMap(() => {
          // If the control is already invalid we don't need to do anything.
          if (this.usernameControl.invalid) return NEVER;

          // Else run validation.
          return interval(500).pipe(
            take(1),
            switchMap(() =>
              this.userService.doesNameExist(this.usernameControl.value),
            ),
          );
        }),
      )
      .subscribe(response => {
        this.usernameControl.markPending(false, {
          source: `userService`,
        });

        const errors = response.payload ? { userNameExists: true } : null;

        this.usernameControl.setErrors(errors, {
          source: `userService`,
        });
      });
  }
}
```

An earlier version of this proposal included an `asyncValidators` property on `AbstractControl` (similar to the current `ReactiveFormsModule`). This property only existed to increase the similarities between the new API and the old API. I decided to remove the `asyncValidators` property in favor of using external services which provide more user control.

It's also worth noting that synchronous validation can also be handled via a service (though traditional `ValidatorFns` are also supported).

### `observe()`

You can `observe()`/`observeChanges()` on any property. Because we know when any properties change, we can easily subscribe to anything via `control.observe('value')` or `control.observe('errors')` etc. The `observe()` method immediately returns the current value, as well as subscribes to all changes. If we just want changes to a property, we can use `control.observeChanges('value')` etc.

Things get even cooler when you use these methods on a `ControlContainer` such as a `FormGroup`. With a form group, we can observe child properties. For example, `formGroup.observeChanges('controls', 'name', 'value')` will subscribe to the value changes of the form groups `"name"` control. If the `"name"` control is removed from the form group, the subscription will emit `undefined`. If the `"name"` control is replaced by a new name control with the same value, our subscription will not re-emit.

We can also drill down even farther. Take the following form group as an example:

```ts
const innerFormGroup = new FormGroup({
  id: new FormControl(1),
  name: new FormControl('John'),
});

const formGroup = new FormGroup({
  people: new FormArray([innerFormGroup]),
});

formGroup
  .observeChanges('controls', 'people', 'controls', 0, 'controls')
  .subscribe(controls => {
    // ... do stuff
  });
```

Here, we are subscribing to changes to the controls of `innerFormGroup`. Also note that this method call has full type safety. i.e. the `controls` value we are subscribing to has the type:

```ts
{ id: FormControl<number>; name: FormControl<string> }
```

# Things not included

Note: the blurbs below assume you are already familiar with the API in this proposal.

### reset()

One of the issue areas which this proposal _used to_ address was around resetting a form control via `reset()`. See issues https://github.com/angular/angular/pull/20214, https://github.com/angular/angular/issues/19747, https://github.com/angular/angular/issues/15741, https://github.com/angular/angular/issues/19251 with a combined 54 upvotes at time of writing.

To this end, most properties in this proposal's `AbstractControl` API used to store a default value. Calling `reset()` used those default values to reset the form control to its user specified default state. After using the API in this proposal for a bit though, I decided that `reset()` didn't make sense in practice. Head on over to issue [#4](https://github.com/thefliik/reactive-forms-2-proposal/issues/4) to learn why and/or give feedback.

### asyncValidators

While an earlier version of this proposal included an `asyncValidators` property (akin to the current ReactiveFormsModule's `asyncValidators` property), I decided to remove it

The reasons why:

1. My guess is that, in the vast majority of cases, async validation is already handled via a service.
2. Async validation will usually want to _debounce_ requests in some way.
3. I have a hard time imagining the situation where you want to _always_ run a generic, async function on every input change in order to perform validation.

Given these reasons, it seemed optimal to simply make validation services the _de facto_ method for performing async validation.

If you have a validation use case which is better handled via the ReactiveFormsModule's current `asyncValidators` syntax than via a service, I'd love to hear it!

### A more wholistic improvement to the errors API

While being able to use services to validate controls is a big improvement, this proposal doesn't address some other existing issues with the errors/validation API.

For example:

1. If a control is required, a `[required]` attribute is not automatically added to the appropriate element in the DOM.
   1. Similarly, other validators should also include DOM changes (e.g. a maxLength validator should add a `[maxlength]` attribute for accessibility, there are ARIA attributes which should be added for accessibility, etc).
   2. If you validate to make sure an input is a number, it's appropriate to add a `type="number"` attribute on the underlying `<input>`.
2. Generating and displaying error messages is much harder than it should be, for such a fundamental part a Forms API.

Ultimately, I see these as failings of the current `ValidatorFn` / `ValidationErrors` API, and should be addressed in a fix to that API. Any such fix should be included in any ReactiveFormsModule2 (and I'm happy to add suitable ideas to this proposal), but at the moment this proposal doesn't include those changes. This is mainly because it allows the discussion to focus on the AbstractControl API, as well as because I don't currently have a great "fix" for the `ValidationErrors` API.

Feedback/suggestions in this area is welcomed!
