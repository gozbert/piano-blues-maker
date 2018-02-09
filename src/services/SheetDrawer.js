import Vex from 'vexflow'
import { Distance, Interval } from 'tonal'
import {keysAccidentals,keysOffsets, accidentalOffsets} from './constants'

const VF = Vex.Flow;

const SCHEME_WIDTH = 350;
const SPACE_BETWEEN_STAVES = 120;
const SPACE_BETWEEN_GRAND_STAVES = 260;
const BAR_MIN_WIDTH = 100;
const ROW_FIRST_BAR_ADDITIONAL_WIDTH = 100;
const LAST_BAR_ADDITIONAL_WIDTH = 15;
const PADDING_TOP = 50;
const PADDING_LEFT = 50;
const EXTRA_SPACE = 20;
const COEFFICIENT = 1;

const SHEET_MIN_WIDTH = 600;


function disributeValue(arr, value, precision) {
  const sum = arr.reduce((sum, value) => sum + value, 0);

  const percentages = arr.map(value => value / sum);

  const valueDistribution = percentages.map(percentage => {
    const factor = Math.pow(10, precision);
    return Math.round(value * percentage * factor) / factor;
  });

  return valueDistribution;
}

class SheetDrawer {
  constructor(container, sections, { width, signature }) {
    this.sheetContainer = container;
    this.sections = sections;
    this.svgWidth = Math.max(width - SCHEME_WIDTH,SHEET_MIN_WIDTH);
    this.sheetWidth = this.svgWidth - PADDING_LEFT * 2;
    this.voicesBeams = [];
    this.voicesTuplets = [];
    this.voicesTies = [];
    this.width = width;
    this.signature = signature;
    // this.rowsCounter = 0;

    this.keyOffset = keysOffsets[signature];
    this.keyAccidentals = keysAccidentals[signature];
  }


  drawGrandStaveRow(currentRowBars, widthArray, rowsCounter, widthRest = 0) {

    let barOffset = PADDING_LEFT;

    //if (widthRest !== 0) {
    const widthRestArray = disributeValue(widthArray, widthRest, 0);
    //}

    currentRowBars.forEach((b, index) => {

      const barWidth = b.barWidth + (widthRest !== 0 ? widthRestArray[index] : 0)

      const trebleStave = new VF.Stave(barOffset, PADDING_TOP + rowsCounter * SPACE_BETWEEN_GRAND_STAVES, barWidth);
      const bassStave = new VF.Stave(barOffset, PADDING_TOP + rowsCounter * SPACE_BETWEEN_GRAND_STAVES + SPACE_BETWEEN_STAVES, barWidth);


      // console.log(`drawing stave, width: ${b.barWidth}`);
      barOffset += barWidth;

      if (index === 0) {
        trebleStave.addClef("treble").addTimeSignature("4/4").addKeySignature(this.signature);
        bassStave.addClef("bass").addTimeSignature("4/4").addKeySignature(this.signature);
        //trebleStave.setMeasure(5);
      }

      const lineLeft = new VF.StaveConnector(trebleStave, bassStave).setType(1);
      const lineRight = new VF.StaveConnector(trebleStave, bassStave).setType(b.isLastBar ? 6 : 0);

      trebleStave.setContext(this.context).draw();
      bassStave.setContext(this.context).draw();

      lineLeft.setContext(this.context).draw();
      lineRight.setContext(this.context).draw();


      var startX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
      trebleStave.setNoteStartX(startX);
      bassStave.setNoteStartX(startX);

      b.formatter.format(b.trebleStaveVoices.concat(b.bassStaveVoices), barWidth
        + (index === 0 ? ROW_FIRST_BAR_ADDITIONAL_WIDTH / 3 : 0)  // ??? временно, переделать
        - (startX - 0)
        - EXTRA_SPACE
        // - (b.isLastBar ? LAST_BAR_ADDITIONAL_WIDTH:0)
      );

      // Render voices
      b.trebleStaveVoices.forEach(function (v) { v.draw(this.context, trebleStave); }.bind(this));
      b.bassStaveVoices.forEach(function (v) { v.draw(this.context, bassStave); }.bind(this));


    });

  }


  buildVoice(voice, symbol, vInd, bInd, pInd, sInd) {

    var vexVoice = new VF.Voice({
      num_beats: 4,
      beat_value: 4,
      resolution: VF.RESOLUTION
    });

    const vexNotes = voice.notes.map((note, nInd) => {

      const { keys, duration, ...options } = note;

      //вспомогательный массив для хранения знаков альтерации,для последующего staveNote.addAccidental 
      const noteKeysAccidentals = [];

      const trasposedKeys = keys.map(key => {

        // не транспонировать паузы
        // todo: транспонировать если несколько голосов
        if (duration.charAt(duration.length - 1) === 'r') {
          return key
        }
        //парсим текущую ноту (key)
        const [keyNameWithAcc, octave] = key.split("/");
        const keyName = keyNameWithAcc.slice(0,1)
        const accidental = keyNameWithAcc.slice(1, (keyNameWithAcc.length + 1) || 9e9);

        const isNatural = (accidental === 'n');

        if (accidental) {
          this.originalAccidentals[keyName+octave] = accidental; 
        }
        
        // todo: check if is natural!!!
        const transposedKey = Distance.transpose(keyName+(isNatural?'':accidental) + octave, Interval.fromSemitones(this.keyOffset));

        const length = transposedKey.length;

        //Note.fromMidi(61, true) // => "C#4"//
        // todo: use note-parser?
        const trKeyNameWithAcc = transposedKey.substr(0, length - 1);
        const trKeyName = trKeyNameWithAcc.slice(0,1)
        const trAccidental = trKeyNameWithAcc.slice(1, (trKeyNameWithAcc.length + 1) || 9e9);

        let vexKey = trKeyNameWithAcc;

        if (this.keyAccidentals[trKeyName] && this.keyAccidentals[trKeyName][trAccidental]) {
          //есть знак при ключе
          vexKey = trKeyName;
        } else { 
          //this.accidentals.push(trKeyNameWithAcc);
        }

        if (!trAccidental && this.keyAccidentals[trKeyName]) {
          //если знак при ключе, но надо сыграть без знака, то бекар 
          vexKey = vexKey + 'n';
        }

        const trOctave = transposedKey.substr(length - 1);
        return vexKey + '/' + trOctave;
      })

      const staveNote = new VF.StaveNote({ keys: trasposedKeys,duration ,...options });

      trasposedKeys.forEach(function (key, i) {
        const keyValue = key.split("/")[0];
        const accidental = keyValue.slice(1, (keyValue.length + 1) || 9e9);

        if (accidental.length > 0) {
          staveNote.addAccidental(i, new VF.Accidental(accidental));
        }
      });

      staveNote.setAttribute('id', `${sInd}-${pInd}-${bInd}-${symbol}-${vInd}-${nInd}`);

      return staveNote;
    });

    if (voice.beams) {
      voice.beams.forEach(beam => {
        const { from, to } = beam;
        this.voicesBeams.push(new VF.Beam(vexNotes.slice(from, to)));
      })
    } else {
      const autoBeams = VF.Beam.generateBeams(vexNotes);
      this.voicesBeams.push(...autoBeams);
    }

    if (voice.tuplets) {
      voice.tuplets.forEach(tuplet => {
        const { from, to, ...options } = tuplet;
        this.voicesTuplets.push(new VF.Tuplet(vexNotes.slice(from, to), options));
      })
    }

    if (voice.ties) {
      voice.ties.forEach(tie => {
        const { from, to, ...options } = tie;
        this.voicesTies.push(new VF.StaveTie({ first_note: vexNotes[from], last_note: vexNotes[to], ...options }));
      })
    }

    vexVoice.addTickables(vexNotes);
    return vexVoice
  }


  draw() {

    const renderer = new VF.Renderer(this.sheetContainer, VF.Renderer.Backends.SVG);

    // Configure the rendering context. 
    //renderer.resize(sheetWidth, 1000);
    this.context = renderer.getContext();
    this.context.setFont("Arial", 10, "").setBackgroundFillStyle("#eed");

    let rowsCounter = 0;
    let currentWidth = 0;
    const currentRowBars = [];
    const widthArray = [];

    // let  calcTime = 0;
    const sectionsLength = this.sections.length;
    this.sections.forEach((section, sInd) => {
      const isLastSection = sInd === sectionsLength - 1;
      const phrasesLength = section.phrases.length;
      //if (section !== null) {
      section.phrases.forEach((phrase, pInd) => {
        const isLastPhrase = pInd === phrasesLength - 1;
        const barsLength = phrase.bars.length;
        phrase.bars.forEach((bar, bInd) => {

          // массив для хранения случайных знаков для текущего такта
          this.accidentals = {};
          // массив для хранения случайных знаков для текущего такта в оригинальной тональности C
          this.originalAccidentals = {};

          const isLastBar = (bInd === barsLength - 1) && isLastPhrase && isLastSection;
          const trebleStaveVoices = bar.trebleVoices.map((voice, vInd) => {
            return this.buildVoice(voice, 't', vInd, bInd, pInd, sInd);
          });

          const bassStaveVoices = bar.bassVoices.map((voice, vInd) => {
            return this.buildVoice(voice, 'b', vInd, bInd, pInd, sInd);
          });


          const formatter = new VF.Formatter();

          formatter.joinVoices(trebleStaveVoices);
          formatter.joinVoices(bassStaveVoices);

          const allVoicesTogether = trebleStaveVoices.concat(bassStaveVoices);

          // let t0 = performance.now(); //!!!!!!
          const minTotalWidth = Math.ceil(formatter.preCalculateMinTotalWidth(allVoicesTogether) * COEFFICIENT);
          // let t1 = performance.now();//!!!!!!!
          //console.log("Calculating min width: " + (t1 - t0) + " milliseconds.")
          // calcTime =+ (t1 - t0);

          const barWidth = Math.max(minTotalWidth, BAR_MIN_WIDTH)
            + EXTRA_SPACE
            + (currentRowBars.length !== 0 ? 0 : ROW_FIRST_BAR_ADDITIONAL_WIDTH)
            + (isLastBar ? LAST_BAR_ADDITIONAL_WIDTH : 0);
          // + (40);




          if (currentWidth + barWidth < this.sheetWidth) {
            // console.log(barWidth);
            currentWidth += barWidth;
            currentRowBars.push({
              bar,
              barWidth,
              formatter,
              trebleStaveVoices,
              bassStaveVoices,
              isLastBar
            });
            widthArray.push(barWidth);
          } else {
            // new stave row
            // draw current row and begin new row 
            const widthRest = this.sheetWidth - currentWidth;
            this.drawGrandStaveRow(currentRowBars, widthArray, rowsCounter, widthRest);
            rowsCounter++;
            currentWidth = barWidth + ROW_FIRST_BAR_ADDITIONAL_WIDTH;
            currentRowBars.length = 0;
            widthArray.length = 0;
            widthArray.push(barWidth + ROW_FIRST_BAR_ADDITIONAL_WIDTH);
            currentRowBars.push({
              bar,
              barWidth: barWidth + ROW_FIRST_BAR_ADDITIONAL_WIDTH,
              formatter,
              trebleStaveVoices,
              bassStaveVoices,
              isLastBar
            });
          }
        });
      });
      //};
    });
    this.drawGrandStaveRow(currentRowBars, widthArray, rowsCounter);

    renderer.resize(this.svgWidth, PADDING_TOP + (SPACE_BETWEEN_GRAND_STAVES) * (rowsCounter + 1));

    this.voicesBeams.forEach((b) => {
      b.setContext(this.context).draw()
    });

    this.voicesTuplets.forEach((tuplet) => {
      tuplet.setContext(this.context).draw();
    });

    this.voicesTies.forEach((tie) => {
      tie.setContext(this.context).draw();
    });


    // console.log("Calculating min width: " + (calcTime) + " milliseconds.")

  }

}

export default SheetDrawer