import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SeadComponent } from './components/sead/sead.component';
import { TilescapeComponent } from './components/tilescape/tilescape.component';
import { VispComponent } from './components/visp/visp.component';
import { WestacComponent } from './components/westac/westac.component';
import { IonicModule } from '@ionic/angular';
import { EnidaComponent } from './components/enida/enida.component';
import { YrkesrumComponent } from './components/yrkesrum/yrkesrum.component';
import { StadenComponent } from './components/staden/staden.component';
import { DigitalamodellerComponent } from './components/digitalamodeller/digitalamodeller.component';
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

@NgModule({
  declarations: [
    AppComponent,
    SeadComponent,
    TilescapeComponent,
    VispComponent,
    WestacComponent,
    EnidaComponent,
    YrkesrumComponent,
    StadenComponent,
    DigitalamodellerComponent,
    UtopiaComponent,
    LinguisticLandscapeComponent,
    InfravisSeadComponent,
    InidunComponent,
    DigitalPeriegesisComponent,
    ShipsComponent,
    IacceptComponent,
    DigibonComponent,
    RaveComponent,
    UmanistaComponent,
    MelodyComponent,
    UtbPlagiatComponent,
    QueerAiComponent,
    DialecticalImaginariesComponent,
    GoingBeyondSearchComponent,
    TcoirComponent,
    SwedebComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    IonicModule.forRoot()
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
