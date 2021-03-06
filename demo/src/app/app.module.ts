import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import {
  MatCardModule,
  MatInputModule,
  MatProgressSpinnerModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatDatepickerModule,
  MatNativeDateModule,
} from '@angular/material';
import { ExampleOneComponent } from './examples/01-example-one/example-one.component';
import { ExampleTwoComponent } from './examples/02-example-two/example-two.component';
import { ExampleThreeComponent } from './examples/03-example-three/example-three.component';
import { ExampleThreeFiveComponent } from './examples/03.5-example-three-five/example-three-five.component';
import { ExampleFourComponent } from './examples/04-example-four/example-four.component';
import {
  ExampleFiveComponent,
  ValidationWrapperComponent,
} from './examples/05-example-five/example-five.component';
import { MyControlDirective } from './examples/05-example-five/my-control.directive';
import { ExampleSixComponent } from './examples/06-example-six/example-six.component';
import { ExampleSevenComponent } from './examples/07-example-seven/example-seven.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ExampleEightComponent } from './examples/08-example-eight/example-eight.component';
import { ExampleNineComponent } from './examples/09-example-nine/example-nine.component';
import { ReactiveFormsModule2 } from 'reactive-forms-module2-proposal';
import { ReactiveFormsModule2Compat } from 'reactive-forms-module2-proposal/compat';

@NgModule({
  declarations: [
    AppComponent,
    ExampleOneComponent,
    ExampleTwoComponent,
    ExampleThreeComponent,
    ExampleThreeFiveComponent,
    ExampleFourComponent,
    ExampleFiveComponent,
    MyControlDirective,
    ValidationWrapperComponent,
    ExampleSixComponent,
    ExampleSevenComponent,
    ExampleEightComponent,
    ExampleNineComponent,
  ],
  imports: [
    BrowserAnimationsModule,
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    ReactiveFormsModule2,
    ReactiveFormsModule2Compat,
    MatCardModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
