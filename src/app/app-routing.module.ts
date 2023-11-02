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
import { DigibonComponent } from './components/digibon/digibon.component';
import { RaveComponent } from './components/rave/rave.component';
import { UmanistaComponent } from './components/umanista/umanista.component';
import { MelodyComponent } from './components/melody/melody.component';
import { UtbPlagiatComponent } from './components/utb-plagiat/utb-plagiat.component';
import { QueerAiComponent } from './components/queer-ai/queer-ai.component';
import { DialecticalImaginariesComponent } from './components/dialectical-imaginaries/dialectical-imaginaries.component';
import { GoingBeyondSearchComponent } from './components/going-beyond-search/going-beyond-search.component';
import { TcoirComponent } from './components/tcoir/tcoir.component';
import { SwedebComponent } from './components/swedeb/swedeb.component';
import { APSComponent } from './components/aps/aps.component';
import { HumlabXComponent } from './components/humlab-x/humlab-x.component';

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
  { path: 'iaccept', component: IacceptComponent},
  { path: 'digibon', component: DigibonComponent},
  { path: 'rave', component: RaveComponent},
  { path: 'umanista', component: UmanistaComponent},
  { path: 'melody', component: MelodyComponent},
  { path: 'plagiat', component: UtbPlagiatComponent},
  { path: 'queer-ai', component: QueerAiComponent},
  { path: 'dialectical-imaginaries', component: DialecticalImaginariesComponent},
  { path: 'going-beyond-search', component: GoingBeyondSearchComponent},
  { path: 'tcoir', component: TcoirComponent},
  { path: 'swedeb', component: SwedebComponent},
  { path: 'aps', component: APSComponent},
  { path: 'humlab-x', component: HumlabXComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
