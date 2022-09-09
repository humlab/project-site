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
import { LinguisticLandscapeComponent } from './components/linguistic-landscape/linguistic-landscape.component';
import { InfravisSeadComponent } from './components/infravis-sead/infravis-sead.component';
import { InidunComponent } from './components/inidun/inidun.component';
import { DigitalPeriegesisComponent } from './components/digital-periegesis/digital-periegesis.component';
import { ShipsComponent } from './components/ships/ships.component';
import { IacceptComponent } from './components/iaccept/iaccept.component';


const routes: Routes = [
  { path: '', component: TilescapeComponent },
  { path: 'sead', component: SeadComponent },
  { path: 'visp', component: VispComponent },
  { path: 'westac', component: WestacComponent },
  { path: 'enida', component: EnidaComponent },
  { path: 'yrkesrum', component: YrkesrumComponent },
  { path: 'staden', component: StadenComponent },
  { path: 'digitalamodeller', component: DigitalamodellerComponent },
  { path: 'utopia', component: UtopiaComponent },
  { path: 'linguistic-landscape', component: LinguisticLandscapeComponent},
  { path: 'infravis-sead', component: InfravisSeadComponent},
  { path: 'inidun', component: InidunComponent},
  { path: 'digital-periegesis', component: DigitalPeriegesisComponent},
  { path: 'ships', component: ShipsComponent},
  { path: 'iaccept', component: IacceptComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
