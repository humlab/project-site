import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DigitalamodellerComponent } from './components/digitalamodeller/digitalamodeller.component';
import { EnidaComponent } from './components/enida/enida.component';
import { SeadComponent } from './components/sead/sead.component';
import { StadenComponent } from './components/staden/staden.component';
import { TilescapeComponent } from './components/tilescape/tilescape.component';
import { VispComponent } from './components/visp/visp.component';
import { WestacComponent } from './components/westac/westac.component';
import { YrkesrumComponent } from './components/yrkesrum/yrkesrum.component';
import { UtopiaComponent } from './components/utopia/utopia.component';

const routes: Routes = [
  { path: '', component: TilescapeComponent },
  { path: 'sead', component: SeadComponent },
  { path: 'visp', component: VispComponent },
  { path: 'westac', component: WestacComponent },
  { path: 'enida', component: EnidaComponent },
  { path: 'yrkesrum', component: YrkesrumComponent },
  { path: 'staden', component: StadenComponent },
  { path: 'digitalamodeller', component: DigitalamodellerComponent },
  { path: 'utopia', component: UtopiaComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
